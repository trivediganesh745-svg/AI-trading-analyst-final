const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Set these with your own App details
const FYERS_APP_ID = process.env.FYERS_APP_ID || "YWHJ9SKCKMK-100";  
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY || "HYXPD49LOS";  
const FYERS_REDIRECT_URI = process.env.FYERS_REDIRECT_URI || "https://www.google.com";  

let fyersAccessToken = null;  // stored after login
let fyersSocket = null;

// ====================================================
// 1️⃣ Get Login URL
// ====================================================
app.get("/get-login-url", (req, res) => {
  const state = "sample"; // you can randomize for security
  const url = `https://api.fyers.in/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${FYERS_REDIRECT_URI}&response_type=code&state=${state}`;
  res.json({ loginUrl: url });
});

// ====================================================
// 2️⃣ Exchange AuthCode for AccessToken
// ====================================================
app.post("/get-access-token", async (req, res) => {
  const { authCode } = req.body;

  if (!authCode) {
    return res.status(400).json({ error: "Missing authCode in request body" });
  }

  try {
    const response = await axios.post("https://api.fyers.in/api/v3/token", {
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_KEY,
      redirect_uri: FYERS_REDIRECT_URI,
      grant_type: "authorization_code",
      code: authCode
    });

    fyersAccessToken = response.data.access_token; // 🔑 save token
    console.log("✅ Access Token Stored:", fyersAccessToken);

    res.json({ success: true, token: fyersAccessToken });
  } catch (error) {
    console.error("❌ Error getting access token:", error.response?.data || error.message);
    res.status(500).json({ error: error.message || "Failed to get access token" });
  }
});

// ====================================================
// 3️⃣ WebSocket Handling (for frontend clients)
// ====================================================
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("🌐 New WebSocket client connected.");

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.type === "subscribe" && data.instrument) {
      if (!fyersAccessToken) {
        ws.send(JSON.stringify({ error: "⚠️ No access token. Please log in first." }));
        return;
      }

      const url = `wss://api-t.fyers.in/socket/v2/data?token=${FYERS_APP_ID}:${fyersAccessToken}&data_type=symbolData`;

      fyersSocket = new WebSocket(url);

      fyersSocket.on("open", () => {
        console.log("📡 Connected to Fyers WS");
        ws.send(JSON.stringify({ status: "connected" }));

        fyersSocket.send(
          JSON.stringify({ symbol: data.instrument, dataType: "symbolData" })
        );
      });

      fyersSocket.on("message", (message) => {
        ws.send(message.toString());
      });

      fyersSocket.on("close", () => {
        console.log("❌ Fyers WebSocket closed");
        ws.send(JSON.stringify({ status: "fyers_ws_closed" }));
      });

      fyersSocket.on("error", (err) => {
        console.error("⚠️ Fyers WebSocket error:", err.message);
        ws.send(JSON.stringify({ error: "Fyers WebSocket failed" }));
      });
    }
  });

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
    if (fyersSocket) {
      fyersSocket.close();
    }
  });
});

// ====================================================
// 4️⃣ Start server
// ====================================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
});

