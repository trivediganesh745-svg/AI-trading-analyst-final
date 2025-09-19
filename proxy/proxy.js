// proxy.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Use environment variables in Render Dashboard → Environment tab
const CLIENT_ID = process.env.CLIENT_ID;   // e.g. "WHJ9SKCKMK-100"
const SECRET_KEY = process.env.SECRET_KEY; // HYXPD49LOS
const REDIRECT_URI = process.env.REDIRECT_URI; // https://www.google.com
let accessToken = null;

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Fyers Proxy Server is running. Use /get-login-url or /get-access-token.");
});

// 🔹 Step 1: Get Login URL
app.get("/get-login-url", (req, res) => {
  const url = `https://api.fyers.in/v3/generate-authcode?client_id=${WHJ9SKCKMK-100}&redirect_uri=${https://www.google.comI}&response_type=code&state=sample`;
  res.json({ login_url: url });
});

// 🔹 Step 2: Exchange authCode for Access Token
app.post("/get-access-token", async (req, res) => {
  const { authCode } = req.body;
  if (!authCode) return res.status(400).json({ error: "authCode is required" });

  try {
    const response = await axios.post("https://api.fyers.in/api/v3/validate-authcode", {
      grant_type: "authorization_code",
      appIdHash: CLIENT_ID,
      secret_key: SECRET_KEY,
      redirect_uri: REDIRECT_URI,
      auth_code: authCode
    });

    accessToken = response.data.access_token;
    res.json({ access_token: accessToken });
  } catch (err) {
    console.error("Error fetching access token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch access token", details: err.response?.data });
  }
});

// 🔹 Step 3: WebSocket Proxy
const server = app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Proxy server running on port ${process.env.PORT || 10000}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Frontend connected to WebSocket proxy");

  if (!accessToken) {
    ws.send(JSON.stringify({ error: "No access token. Please login first." }));
    ws.close();
    return;
  }

  const fyersWS = new WebSocket(`wss://api.fyers.in/socket/v3/data?token=${CLIENT_ID}:${accessToken}`);

  fyersWS.on("open", () => console.log("Connected to Fyers WebSocket"));

  fyersWS.on("message", (msg) => {
    ws.send(msg.toString());
  });

  ws.on("message", (msg) => {
    fyersWS.send(msg.toString());
  });

  fyersWS.on("close", () => ws.close());
  fyersWS.on("error", (err) => console.error("Fyers WS error:", err));
});
