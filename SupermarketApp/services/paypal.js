// SupermarketApp/services/paypal.js
const axios = require("axios");

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

async function generateAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in .env");
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
}

async function createOrder(total, currency = "SGD") {
  const accessToken = await generateAccessToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: Number(total).toFixed(2),
        },
      },
    ],
  };

  const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data; // contains id
}

async function captureOrder(orderId) {
  const accessToken = await generateAccessToken();

  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

module.exports = {
  createOrder,
  captureOrder,
};