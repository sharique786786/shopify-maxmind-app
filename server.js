import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { WebServiceClient } from "@maxmind/geoip2-node";
import { Client as MinFraudClient } from "@maxmind/minfraud-api-node";
import * as minFraud from "@maxmind/minfraud-api-node";
import axios from "axios";

dotenv.config();

const app = express();

// Trust proxies (Render, Cloudflare, etc.)
app.set("trust proxy", true);

// Raw body for Shopify webhook HMAC, JSON for everything else
app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

// --- MaxMind clients ---
const geoClient = new WebServiceClient(
  process.env.MAXMIND_ACCOUNT_ID,
  process.env.MAXMIND_LICENSE_KEY
);
const minFraudClient = new MinFraudClient(
  process.env.MAXMIND_ACCOUNT_ID,
  process.env.MAXMIND_LICENSE_KEY
);

// Helper: extract first IP from x-forwarded-for
const getClientIp = (req) => {
  const h = req.headers["x-forwarded-for"] || "";
  return h ? h.split(",")[0].trim() : req.ip;
};

// --------- GEOIP ---------
app.get("/geoip", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const r = await geoClient.city(ip);
    res.json({
      ip,
      country: r.country?.isoCode,
      city: r.city?.names?.en,
      traits: r.traits,
    });
  } catch (err) {
    console.error("GeoIP error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------- Helper: clean object ---------
const cleanObject = (obj) => {
  if (obj && typeof obj === "object") {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === "object") {
        cleanObject(obj[key]);
      }
      if (
        obj[key] === undefined ||
        obj[key] === null ||
        (typeof obj[key] === "object" && Object.keys(obj[key]).length === 0)
      ) {
        delete obj[key];
      }
    });
  }
  return obj;
};

// --------- /minfraud/score (test in Postman) ---------
app.post("/minfraud/score", async (req, res) => {
  try {
    const { order = {}, ip: ipFromBody } = req.body;
    const ip = ipFromBody || order?.client_details?.browser_ip;

    // Build a Transaction using SDK classes
    const transaction = new minFraud.Transaction({
      device: ip ? new minFraud.Device({ ipAddress: ip }) : undefined,
      email: order.email ? new minFraud.Email({ address: order.email }) : undefined,
      billing: order.billing_address
        ? new minFraud.Billing({
            firstName: order.billing_address.first_name,
            lastName: order.billing_address.last_name,
            address: order.billing_address.address1,
            address2: order.billing_address.address2,
            city: order.billing_address.city,
            region:
              order.billing_address.province_code ||
              order.billing_address.province,
            postal: order.billing_address.zip,
            country: order.billing_address.country_code,
            phoneNumber: order.billing_address.phone,
          })
        : undefined,
      shipping: order.shipping_address
        ? new minFraud.Shipping({
            firstName: order.shipping_address.first_name,
            lastName: order.shipping_address.last_name,
            address: order.shipping_address.address1,
            address2: order.shipping_address.address2,
            city: order.shipping_address.city,
            region:
              order.shipping_address.province_code ||
              order.shipping_address.province,
            postal: order.shipping_address.zip,
            country: order.shipping_address.country_code,
            phoneNumber: order.shipping_address.phone,
          })
        : undefined,
      order:
        order.total_price && order.currency
          ? new minFraud.Order({
              amount: Number(order.total_price),
              currency: order.currency,
            })
          : undefined,
    });

    console.log("Sending transaction to MaxMind:", JSON.stringify(transaction, null, 2));

    // Send to MaxMind
    const resp = await minFraudClient.score(transaction);

    res.json({
      riskScore: resp?.riskScore ?? resp?.risk_score ?? null,
      disposition: resp?.disposition ?? null,
      raw: resp,
    });
  } catch (err) {
    console.error("minFraud error:", err);
    res.status(500).json({ error: err.message });
  }
});


// --------- Shopify webhook HMAC verify ---------
function verifyShopifyWebhook(req, res, next) {
  try {
    const hmac = req.get("x-shopify-hmac-sha256");
    const rawBody = req.body; // Buffer (express.raw used above)
    const digest = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(rawBody, "utf8")
      .digest("base64");

    const safeEqual =
      hmac &&
      digest &&
      crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));

    if (!safeEqual) return res.status(401).send("Invalid HMAC");

    req.parsedBody = JSON.parse(rawBody.toString("utf8"));
    next();
  } catch (e) {
    console.error("Webhook verify error:", e);
    return res.status(400).send("Bad Request");
  }
}

// --------- /webhooks/orders/create ---------

app.post(
  "/webhooks/orders/create",
  verifyShopifyWebhook,
  async (req, res) => {
    const order = req.parsedBody;

    try {
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
              address: order.billing_address.address1,
              city: order.billing_address.city,
              postal: order.billing_address.zip,
              country: order.billing_address.country_code,
            }
          : undefined,
        shipping: order.shipping_address
          ? {
              first_name: order.shipping_address.first_name,
              last_name: order.shipping_address.last_name,
              address: order.shipping_address.address1,
              city: order.shipping_address.city,
              postal: order.shipping_address.zip,
              country: order.shipping_address.country_code,
            }
          : undefined,
        order:
          order.total_price && order.currency
            ? {
                amount: Number(order.total_price),
                currency: order.currency,
              }
            : undefined,
      };

      const resp = await minFraudClient.score(payload);
      const riskScore = resp?.riskScore ?? 0;

      console.log("Webhook riskScore:", riskScore);

      // --- Decide tag based on thresholds ---
      let tag = "fraud-low-risk";
      if (riskScore >= 70) tag = "fraud-high-risk";
      else if (riskScore >= 30) tag = "fraud-medium-risk";

      // --- Apply tag to order in Shopify ---
      await axios({
        method: "PUT",
        url: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/orders/${order.id}.json`,
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        data: {
          order: {
            id: order.id,
            tags: `${order.tags}, ${tag}`.trim(),
          },
        },
      });

      res.sendStatus(200);
    } catch (err) {
      console.error("Fraud webhook error:", err);
      res.sendStatus(200); // always 200 so Shopify doesn’t retry
    }
  }
);


// --------- Health ---------
app.get("/health", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

// --------- Fraud Check ---------
app.post('/api/fraud-check', async (req, res) => {
  try {
    const fraudRes = await axios.post(
      `https://minfraud.maxmind.com/minfraud/v2.0/score`,
      req.body,
      {
        auth: { username: MAXMIND_ACCOUNT_ID, password: MAXMIND_LICENSE_KEY }
      }
    );
    res.json(fraudRes.data);
  } catch (error) {
    res.status(500).json({ error: 'Fraud Check Failed' });
  }
});
