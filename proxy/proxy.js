// proxy.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const { authenticator } = require("otplib"); // TOTP
const crypto = require("crypto"); // SHA256
const protobuf = require("protobufjs"); // Decode Fyers WebSocket data

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Use environment variables in Render / local env
const FYERS_APP_ID = process.env.FYERS_APP_ID; // e.g., DBU01IOF2L-100
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY; // e.g., O#NNL8SOYFP

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
  res.send("✅ Fyers Direct Login Proxy running. Use /direct-login.");
});

// 🔹 Direct Login Endpoint
app.post("/direct-login", async (req, res) => {
  const { fyersId, pin, totpSecret } = req.body;
  if (!fyersId || !pin || !totpSecret) {
    return res.status(400).json({ error: "fyersId, pin, and totpSecret are required" });
  }

  try {
    // Step 1: Send login OTP
    const otpResp = await axios.post("https://api.fyers.in/api/v3/send_login_otp", {
      fy_id: fyersId,
      app_id: FYERS_APP_ID.split("-")[0] // part before dash
    }, { headers: { "Content-Type": "application/json" } });

    if (otpResp.data.s !== "ok") throw new Error(otpResp.data.m || "send_login_otp failed");
    const request_key = otpResp.data.request_key;

    // Step 2: Verify TOTP
    const totp = authenticator.generate(totpSecret);
    const totpResp = await axios.post("https://api.fyers.in/api/v3/verify_totp", {
      request_key: request_key,
      otp: totp
    }, { headers: { "Content-Type": "application/json" } });

    if (totpResp.data.s !== "ok") throw new Error(totpResp.data.m || "verify_totp failed");
    const pin_request_key = totpResp.data.request_key;

    // Step 3: Verify PIN
    const pinResp = await axios.post("https://api.fyers.in/api/v3/verify_pin", {
      request_key: pin_request_key,
      identity_type: "pin",
      identifier: pin
    }, { headers: { "Content-Type": "application/json" } });

    if (pinResp.data.s !== "ok") throw new Error(pinResp.data.m || "verify_pin failed");
    const auth_code_for_token = pinResp.data.data.auth_code; // Correct key is auth_code

    // Step 4: Generate Access Token
    const appHash = crypto.createHash("sha256")
      .update(`${FYERS_APP_ID.split("-")[0]}:${FYERS_SECRET_KEY}`)
      .digest("hex");

    const tokenResp = await axios.post("https://api.fyers.in/api/v3/token", {
      grant_type: "authorization_code",
      appIdHash: appHash,
      code: auth_code_for_token
    }, { headers: { "Content-Type": "application/json" } });

    if (tokenResp.data.s !== "ok") throw new Error(tokenResp.data.m || "token generation failed");

    accessToken = tokenResp.data.access_token;
    console.log("✅ Access token obtained successfully");
    res.json({ access_token: accessToken });

  } catch (err) {
    console.error("❌ Direct login error:", err.response?.data || err.message);
    res.status(500).json({ error: "Direct login failed", details: err.response?.data });
  }
});

// 🔹 WebSocket Proxy
const server = app.listen(process.env.PORT || 10000, () => {
  console.log(`🚀 Proxy running on port ${process.env.PORT || 10000}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (clientWs) => {
  console.log("✅ Frontend connected to WebSocket proxy");

  if (!accessToken) {
    clientWs.send(JSON.stringify({ type: "error", message: "No access token. Please login first." }));
    clientWs.close();
    return;
  }

  const fyersWs = new WebSocket(
    `wss://api-ws.fyers.in/socket/v3/data?token=${FYERS_APP_ID.split("-")[0]}:${accessToken}&data_type=symbolData&log_level=1`
  );

  fyersWs.on("open", () => console.log("✅ Connected to Fyers WebSocket"));

  fyersWs.on("message", (message) => {
    try {
      const decoded = MarketData.decode(message);
      clientWs.send(JSON.stringify({
        type: "tick",
        data: {
          symbol: decoded.symbol,
          ltp: decoded.ltp,
          price: decoded.ltp,
          volume: decoded.volume,
          timestamp: decoded.timestamp
        }
      }));
    } catch (e) {
      console.error("Protobuf decode error:", e);
    }
  });

  clientWs.on("message", (msg) => {
    try {
      const m = JSON.parse(msg.toString());
      if (m.type === "subscribe") {
        fyersWs.send(JSON.stringify({ T: "SUB_DATA", symbol: [m.instrument] }));
      } else if (m.type === "unsubscribe") {
        fyersWs.send(JSON.stringify({ T: "UNSUB_DATA", symbol: [m.instrument] }));
      }
    } catch (e) {
      console.error("Client message parse error:", e);
    }
  });

  fyersWs.on("close", (code, reason) => {
    console.log(`❌ Fyers WS disconnected: ${code} - ${reason}`);
    clientWs.close();
  });

  fyersWs.on("error", (err) => {
    console.error("❌ Fyers WS error:", err);
    clientWs.close();
  });

  clientWs.on("close", () => {
    console.log("🔌 Frontend disconnected");
    if (fyersWs.readyState === WebSocket.OPEN) fyersWs.close();
  });
});


