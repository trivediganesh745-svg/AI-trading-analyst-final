// proxy.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const { authenticator } = require("otplib"); // For 2FA/TOTP
const crypto = require("crypto"); // For SHA256 hashing
const protobuf = require("protobufjs"); // For decoding Fyers WebSocket data

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Use environment variables in Render Dashboard → Environment tab
// Example: WHJ9SKCKMK-100
const FYERS_APP_ID = process.env.FYERS_APP_ID; 
// Example: HYXPD49LOS
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY; 

// This will be stored in memory after a successful login
let accessToken = null;

// Proto definition for Fyers WebSocket data
const protoStr = `
syntax = "proto3";
message MarketData {
    string symbol = 1;
    double ltp = 2;
    int64 timestamp = 3;
    int64 volume = 4;
}
`;
const root = protobuf.parse(protoStr).root;
const MarketData = root.lookupType("MarketData");

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Fyers Direct Login Proxy is running. Use /direct-login.");
});

// 🔹 New Direct Login Endpoint
app.post("/direct-login", async (req, res) => {
  const { fyersId, pin, totpSecret } = req.body;

  if (!fyersId || !pin || !totpSecret) {
    return res.status(400).json({ error: "fyersId, pin, and totpSecret are required" });
  }

  try {
    // Step 1: Send Login OTP to get a request_key
    const otpResponse = await axios.post("https://api.fyers.in/api/v3/send_login_otp", {
      fy_id: fyersId,
      app_id: FYERS_APP_ID.split('-')[0] // Fyers expects the part before '-100'
    }, { headers: {'Content-Type': 'application/json'} });

    if (otpResponse.data.s !== 'ok') throw new Error(otpResponse.data.message || 'send_login_otp failed');
    const request_key = otpResponse.data.request_key;

    // Step 2: Verify TOTP
    const totp = authenticator.generate(totpSecret);
    const totpResponse = await axios.post("https://api.fyers.in/api/v3/verify_totp", {
      request_key: request_key,
      otp: totp
    }, { headers: {'Content-Type': 'application/json'} });
    
    if (totpResponse.data.s !== 'ok') throw new Error(totpResponse.data.message || 'verify_totp failed');
    const pin_request_key = totpResponse.data.request_key;

    // Step 3: Verify PIN
    const pinResponse = await axios.post("https://api.fyers.in/api/v3/verify_pin", {
      request_key: pin_request_key,
      identity_type: "pin",
      identifier: pin
    }, { headers: {'Content-Type': 'application/json'} });

    if (pinResponse.data.s !== 'ok') throw new Error(pinResponse.data.message || 'verify_pin failed');
    const auth_code_for_token = pinResponse.data.data.access_token; // This is a temporary auth code

    // Step 4: Generate Final Access Token
    const appIdHash = crypto.createHash('sha256').update(`${FYERS_APP_ID}:${FYERS_SECRET_KEY}`).digest('hex');
    const tokenResponse = await axios.post("https://api.fyers.in/api/v3/token", {
      grant_type: "authorization_code",
      appIdHash: appIdHash,
      code: auth_code_for_token
    }, { headers: {'Content-Type': 'application/json'} });
    
    if (tokenResponse.data.s !== 'ok') throw new Error(tokenResponse.data.message || 'token generation failed');

    accessToken = tokenResponse.data.access_token;
    console.log("✅ Successfully obtained access token.");
    res.json({ access_token: accessToken });

  } catch (err) {
    const errorDetails = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`❌ Direct login error: ${errorDetails}`);
    res.status(500).json({ error: "Direct login failed", details: err.response?.data });
  }
});


// 🔹 WebSocket Proxy Logic
const server = app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Proxy server running on port ${process.env.PORT || 10000}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (clientWs) => {
  console.log("✅ Frontend connected to WebSocket proxy");

  if (!accessToken) {
    clientWs.send(JSON.stringify({ type: "error", message: "No access token. Please login first." }));
    clientWs.close();
    return;
  }

  const fyersWs = new WebSocket(`wss://api-ws.fyers.in/socket/v3/data?token=${FYERS_APP_ID}:${accessToken}&data_type=symbolData&log_level=1`);

  fyersWs.on("open", () => console.log("✅ Connected to Fyers WebSocket"));

  // Forward decoded messages from Fyers to the client
  fyersWs.on("message", (message) => {
    try {
      if (Buffer.isBuffer(message)) {
          // Decode the binary Protobuf message
          const decoded = MarketData.decode(message);
          const tickData = {
            ltp: decoded.ltp,
            price: decoded.ltp, // for compatibility
            volume: decoded.volume,
            timestamp: decoded.timestamp
          };
          
          // Send clean JSON to the frontend
          clientWs.send(JSON.stringify({ type: "tick", data: tickData }));
      }
    } catch (e) {
      console.error("Protobuf decoding error:", e);
    }
  });

  // Forward subscription messages from the client to Fyers
  clientWs.on("message", (message) => {
    try {
      const clientMsg = JSON.parse(message.toString());
      if (clientMsg.type === 'subscribe') {
        fyersWs.send(JSON.stringify({ "T": "SUB_DATA", "symbol": [clientMsg.instrument] }));
        console.log(`[PROXY] Subscribed to ${clientMsg.instrument}`);
      } else if (clientMsg.type === 'unsubscribe') {
        fyersWs.send(JSON.stringify({ "T": "UNSUB_DATA", "symbol": [clientMsg.instrument] }));
        console.log(`[PROXY] Unsubscribed from ${clientMsg.instrument}`);
      }
    } catch (e) {
      console.error("Could not parse client message:", e);
    }
  });

  fyersWs.on("close", (code, reason) => {
    console.log(`❌ Fyers WebSocket disconnected: ${code} - ${reason.toString()}`);
    clientWs.close();
  });

  fyersWs.on("error", (err) => {
    console.error("❌ Fyers WS error:", err);
    clientWs.close();
  });

  clientWs.on("close", () => {
    console.log("🔌 Frontend disconnected, closing Fyers connection.");
    if (fyersWs.readyState === WebSocket.OPEN) {
      fyersWs.close();
    }
  });
});
