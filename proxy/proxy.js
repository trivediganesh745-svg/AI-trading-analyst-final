require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const protobuf = require("protobufjs");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

const {
    FYERS_APP_ID,
    FYERS_SECRET_KEY,
    FYERS_REDIRECT_URI,
    PORT
} = process.env;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URI) {
    console.error("❌ Missing environment variables (FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URI).");
    process.exit(1);
}

let fyersAccessToken = null;
let fyersRefreshToken = null;

const FYERS_API_V3_BASE = "https://api.fyers.in/api/v3";

// --- Protobuf Definition ---
const proto_def = `
syntax = "proto3";
message MarketData {
    int64 timestamp = 1;
    double ltp = 2;
    int64 volume = 3;
}
`;
const root = require("protobufjs").parse(proto_def).root;
const MarketData = root.lookupType("MarketData");

// --- Routes ---

// Health check
app.get("/", (req, res) => {
    res.send("✅ Fyers Proxy Server is running.");
});

// Step 1: Generate login URL
app.get("/generate-auth-url", (req, res) => {
    const authUrl = `${FYERS_API_V3_BASE}/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=some_state`;
    console.log("🔗 Login URL generated.");
    res.json({ url: authUrl });
});

// Step 2: Exchange code for token
app.post("/exchange-token", async (req, res) => {
    const { auth_code } = req.body;
    if (!auth_code) {
        return res.status(400).json({ error: "Missing auth_code" });
    }

    try {
        const response = await axios.post(`${FYERS_API_V3_BASE}/token`, {
            grant_type: "authorization_code",
            client_id: FYERS_APP_ID,
            secret_key: FYERS_SECRET_KEY,
            code: auth_code,
            redirect_uri: FYERS_REDIRECT_URI
        });

        const { access_token, refresh_token } = response.data;

        if (!access_token) {
            throw new Error("Access token missing from response");
        }

        fyersAccessToken = access_token;
        fyersRefreshToken = refresh_token;

        console.log("✅ Access token received.");
        res.json({ access_token, refresh_token });

    } catch (err) {
        console.error("❌ Token exchange failed:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to exchange token", details: err.response?.data || err.message });
    }
});

// Optional: Token refresh endpoint
app.post("/refresh-token", async (req, res) => {
    try {
        if (!fyersRefreshToken) {
            return res.status(400).json({ error: "No refresh token available" });
        }

        const response = await axios.post(`${FYERS_API_V3_BASE}/token`, {
            grant_type: "refresh_token",
            client_id: FYERS_APP_ID,
            secret_key: FYERS_SECRET_KEY,
            refresh_token: fyersRefreshToken
        });

        const { access_token, refresh_token } = response.data;

        fyersAccessToken = access_token;
        fyersRefreshToken = refresh_token;

        console.log("♻️ Access token refreshed.");
        res.json({ access_token, refresh_token });

    } catch (err) {
        console.error("❌ Token refresh failed:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to refresh token", details: err.response?.data || err.message });
    }
});

// --- WebSocket Integration ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let fyersWS = null;
const clientSockets = new Set();

const connectToFyers = (token) => {
    if (fyersWS && (fyersWS.readyState === WebSocket.OPEN || fyersWS.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const [appIdBase] = FYERS_APP_ID.split("-");
    const wsUrl = `wss://api.fyers.in/socket/v3/data?token=${appIdBase}:${token}&data_type=symbolData&log_level=1`;

    console.log("🔌 Connecting to Fyers WebSocket...");
    fyersWS = new WebSocket(wsUrl);

    fyersWS.on("open", () => {
        console.log("✅ Connected to Fyers WebSocket.");
    });

    fyersWS.on("message", (msg) => {
        try {
            const decoded = MarketData.decode(msg);
            const data = JSON.stringify({ type: "tick", data: decoded });
            clientSockets.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        } catch (e) {
            console.error("❌ Protobuf decode error:", e.message);
        }
    });

    fyersWS.on("close", (code) => {
        console.warn(`⚠️ Fyers WebSocket closed (code: ${code})`);
        fyersWS = null;
        clientSockets.forEach(client =>
            client.send(JSON.stringify({ type: "error", message: "Fyers WebSocket disconnected" }))
        );
    });

    fyersWS.on("error", (err) => {
        console.error("❌ Fyers WebSocket error:", err.message);
    });
};

wss.on("connection", (ws) => {
    console.log("🧩 Frontend WebSocket connected.");
    clientSockets.add(ws);

    ws.on("message", (msg) => {
        try {
            const parsed = JSON.parse(msg);
            const tokenToUse = parsed.accessToken || fyersAccessToken;

            if (parsed.type === "subscribe") {
                if (!tokenToUse) {
                    return ws.send(JSON.stringify({ error: "Missing access token for subscription." }));
                }

                connectToFyers(tokenToUse);

                const subscribe = () => {
                    if (fyersWS?.readyState === WebSocket.OPEN) {
                        const sub = { T: "SUB_DATA", symbol: [parsed.instrument] };
                        fyersWS.send(JSON.stringify(sub));
                        console.log("📡 Subscribed to:", parsed.instrument);
                    }
                };

                if (fyersWS?.readyState === WebSocket.OPEN) {
                    subscribe();
                } else {
                    fyersWS?.once("open", subscribe);
                }
            }

            if (parsed.type === "unsubscribe" && fyersWS?.readyState === WebSocket.OPEN) {
                const unsub = { T: "UNSUB_DATA", symbol: [parsed.instrument] };
                fyersWS.send(JSON.stringify(unsub));
                console.log("🛑 Unsubscribed from:", parsed.instrument);
            }
        } catch (e) {
            console.error("❌ Error handling frontend message:", e.message);
        }
    });

    ws.on("close", () => {
        console.log("❌ Frontend WebSocket disconnected.");
        clientSockets.delete(ws);
    });
});

// Start server
const port = PORT || 10000;
server.listen(port, () => {
    console.log(`🚀 Fyers Proxy running on port ${port}`);
});

