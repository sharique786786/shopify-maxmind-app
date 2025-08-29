import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WebServiceClient } from '@maxmind/geoip2-node';
import { Client as MinFraudClient } from '@maxmind/minfraud-api';

dotenv.config();

const app = express();

// Behind proxies (Render/Cloudflare) so req.ip works correctly
app.set('trust proxy', true);

// --- Body parsers ---
// Shopify webhooks require RAW body for HMAC verification:
app.use('/webhooks', express.raw({ type: 'application/json' }));
// JSON for everything else:
app.use(express.json());

// MaxMind clients
const geoClient = new WebServiceClient(
  process.env.MAXMIND_ACCOUNT_ID,
  process.env.MAXMIND_LICENSE_KEY
);
const minFraudClient = new MinFraudClient(
  process.env.MAXMIND_ACCOUNT_ID,
  process.env.MAXMIND_LICENSE_KEY
);

// Small helper: first public IP from XFF list
const getClientIp = (req) => {
  const h = req.headers['x-forwarded-for'] || '';
  const ip = h ? h.split(',')[0].trim() : req.ip;
  return ip;
};

// ---------- GEOIP ----------
app.get('/geoip', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const r = await geoClient.city(ip);
    res.json({
      ip,
      country: r.country?.isoCode,
      city: r.city?.names?.en,
      traits: r.traits
    });
  } catch (err) {
    console.error('GeoIP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- minFRAUD SCORE (direct API) ----------
// Utility: recursively remove null, undefined, or empty objects
const cleanObject = (obj) => {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (obj[key] && typeof obj[key] === 'object') {
        cleanObject(obj[key]);
      }
      if (
        obj[key] === undefined ||
        obj[key] === null ||
        (typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0)
      ) {
        delete obj[key];
      }
    });
  }
  return obj;
};

app.post('/minfraud/score', async (req, res) => {
  try {
    const { order = {}, ip: ipFromBody } = req.body;

    const ip = ipFromBody || order?.client_details?.browser_ip;

    let payload = {
      device: ip ? { ip_address: ip } : undefined,
      email: order.email ? { address: order.email } : undefined,
      billing: order.billing_address ? {
        first_name: order.billing_address.first_name,
        last_name: order.billing_address.last_name,
        address: {
          line_1: order.billing_address.address1,
          line_2: order.billing_address.address2,
          city: order.billing_address.city,
          region: order.billing_address.province_code || order.billing_address.province,
          postal: order.billing_address.zip,
          country: order.billing_address.country_code
        },
        phone_number: order.billing_address.phone
      } : undefined,
      shipping: order.shipping_address ? {
        first_name: order.shipping_address.first_name,
        last_name: order.shipping_address.last_name,
        address: {
          line_1: order.shipping_address.address1,
          line_2: order.shipping_address.address2,
          city: order.shipping_address.city,
          region: order.shipping_address.province_code || order.shipping_address.province,
          postal: order.shipping_address.zip,
          country: order.shipping_address.country_code
        },
        phone_number: order.shipping_address.phone
      } : undefined,
      order: (order.total_price && order.currency) ? {
        amount: Number(order.total_price),
        currency: order.currency
      } : undefined
    };

    // Clean payload before sending
    payload = cleanObject(payload);

    console.log("Sending payload to MaxMind:", JSON.stringify(payload, null, 2));

    const resp = await minFraudClient.score(payload);

    // Risk score and disposition
    const riskScore = resp?.riskScore ?? resp?.risk_score ?? null;
    const disposition = resp?.disposition ?? null;

    res.json({ riskScore, disposition, raw: resp });
  } catch (err) {
    console.error('minFraud error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ---------- Shopify HMAC verification ----------
function verifyShopifyWebhook(req, res, next) {
  try {
    const hmac = req.get('x-shopify-hmac-sha256');
    const rawBody = req.body; // Buffer (because express.raw on /webhooks)
    const digest = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64');

    const safeEqual =
      hmac &&
      digest &&
      crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(hmac, 'utf8'));

    if (!safeEqual) return res.status(401).send('Invalid HMAC');
    // parse after verification
    req.parsedBody = JSON.parse(rawBody.toString('utf8'));
    next();
  } catch (e) {
    console.error('Webhook verify error:', e);
    return res.status(400).send('Bad Request');
  }
}

// ---------- Orders Create Webhook ----------
app.post('/webhooks/orders/create', verifyShopifyWebhook, async (req, res) => {
  const order = req.parsedBody;

  try {
    // Call minFraud directly (faster than HTTP to self)
    const ip =
      order?.client_details?.browser_ip ||
      order?.customer?.default_address?.ip_address ||
      undefined;

    const payload = {
      device: ip ? { ip_address: ip } : undefined,
      email: order.email ? { address: order.email } : undefined,
      billing: order.billing_address
        ? {
            first_name: order.billing_address.first_name,
            last_name: order.billing_address.last_name,
            address: {
              line_1: order.billing_address.address1,
              line_2: order.billing_address.address2,
              city: order.billing_address.city,
              region: order.billing_address.province_code || order.billing_address.province,
              postal: order.billing_address.zip,
              country: order.billing_address.country_code
            },
            phone_number: order.billing_address.phone
          }
        : undefined,
      shipping: order.shipping_address
        ? {
            first_name: order.shipping_address.first_name,
            last_name: order.shipping_address.last_name,
            address: {
              line_1: order.shipping_address.address1,
              line_2: order.shipping_address.address2,
              city: order.shipping_address.city,
              region: order.shipping_address.province_code || order.shipping_address.province,
              postal: order.shipping_address.zip,
              country: order.shipping_address.country_code
            },
            phone_number: order.shipping_address.phone
          }
        : undefined,
      order: (order.total_price && order.currency)
        ? {
            amount: Number(order.total_price),
            currency: order.currency
          }
        : undefined
    };

    const resp = await minFraudClient.score(payload);
    const riskScore = resp?.riskScore ?? resp?.risk_score ?? 0;

    // Tag + (optional) save metafield
    if (riskScore >= Number(process.env.RISK_THRESHOLD || 20)) {
      await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/orders/${order.id}.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order: { id: order.id, tags: `${order.tags || ''}, High Fraud Risk`.trim() }
          })
        }
      );
    }

    // Save risk score to an order metafield (optional, handy for analytics)
    if (process.env.SAVE_METAFIELD === 'true') {
      await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/orders/${order.id}/metafields.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metafield: {
              namespace: 'fraud',
              key: 'minfraud_risk_score',
              type: 'number_decimal',
              value: String(riskScore)
            }
          })
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Fraud webhook error:', err);
    // Always 200 to avoid webhook retries if you prefer; or 500 to retry:
    res.sendStatus(200);
  }
});

// Health check
app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
