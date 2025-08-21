import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { WebServiceClient } from '@maxmind/geoip2-node';
import { Client as MinFraudClient } from '@maxmind/minfraud-api-node';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// ✅ MaxMind Clients
const geoClient = new WebServiceClient(process.env.MAXMIND_ACCOUNT_ID, process.env.MAXMIND_LICENSE_KEY);
const minFraudClient = new MinFraudClient(process.env.MAXMIND_ACCOUNT_ID, process.env.MAXMIND_LICENSE_KEY);

// ✅ GeoIP endpoint
app.get('/geoip', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const response = await geoClient.city(ip);

    res.json({
      ip,
      country: response.country.isoCode,
      city: response.city.names.en,
      region: response.subdivisions[0]?.names.en
    });
  } catch (error) {
    console.error('GeoIP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ minFraud Score endpoint
app.post('/minfraud/score', async (req, res) => {
  try {
    const { order, ip } = req.body;

    const requestData = {
      device: { ip_address: ip },
      billing: {
        first_name: order.billing_address?.first_name,
        last_name: order.billing_address?.last_name,
        address: order.billing_address?.address1,
        city: order.billing_address?.city,
        postal: order.billing_address?.zip,
        country: order.billing_address?.country_code
      },
      email: { address: order.email }
    };

    const fraudResponse = await minFraudClient.score(requestData);

    res.json({
      riskScore: fraudResponse.risk_score,
      disposition: fraudResponse.disposition
    });
  } catch (error) {
    console.error('minFraud error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Shopify Webhook for Orders
app.post('/webhooks/orders/create', async (req, res) => {
  const order = req.body;
  const ip = order.client_details?.browser_ip || '';

  try {
    const fraudCheck = await fetch(`${process.env.APP_URL}/minfraud/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, ip })
    });

    const fraudData = await fraudCheck.json();

    if (fraudData.riskScore > 20) {
      // Tag order as High Fraud Risk
      await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/orders/${order.id}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order: {
            id: order.id,
            tags: `${order.tags}, High Fraud Risk`
          }
        })
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Fraud webhook error:', error);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 3000}`);
});
