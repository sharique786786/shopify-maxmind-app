import dotenv from "dotenv";
import { Client as MinFraudClient } from "@maxmind/minfraud-api-node";

dotenv.config();

async function run() {
  try {
    const minFraudClient = new MinFraudClient(
      process.env.MAXMIND_ACCOUNT_ID,
      process.env.MAXMIND_LICENSE_KEY
    );

    const transactionData = {
      device: {
        ip_address: "27.62.209.42"
      },
      email: {
        address: "john@example.com"
      },
      billing: {
        first_name: "John",
        last_name: "Doe",
        address: {
          line_1: "123 Main St",
          city: "Indore",
          postal: "452001",
          country: "IN"
        }
      }
    };

    console.log("Sending to MaxMind:", JSON.stringify(transactionData, null, 2));

    const response = await minFraudClient.score(transactionData);
    console.log("✅ Response from MaxMind:", response);
  } catch (err) {
    console.error("❌ Error calling MinFraud:", err);
  }
}

run();
