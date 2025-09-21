const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const crypto = require("crypto");
const protobuf = require("protobufjs");

const app = express();
app.use(cors());
app.use(express.json());

const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY;
const FYERS_REDIRECT_URI = process.env.FYERS_REDIRECT_URI;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URI) {
    console.error("❌ Missing Fyers environment variables.");
    process.exit(1);
}

let fyersAccessToken = null;

const FYERS_API_V3_BASE = "https://api.fyers.in/api/v3";

// --- Protobuf ---
const proto_def = `
syntax = "proto3";
message MarketData {
    int64 timestamp = 1;
    double ltp = 2;
    int64 volume = 3;
}
`;
const root = protobuf.parse(proto_def).root;
const MarketData = root.lookupType("MarketData");

// --- Routes ---
app.get("/", (req, res) => {
    res.send("✅ Fyers Proxy Server is running.");
});

app.get("/generate-auth-url", (req, res) => {
    const url = `https://api.fyers.in/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=sample_state`;
    res.json({ url });
});

app.post("/exchange-token", async (req, res) => {
    const { auth_code } = req.body;
    if (!auth_code) return res.status(400).json({ error: "Missing auth_code." });

    try {
        const appIdHash = crypto
            .createHash("sha256")
            .update(`${FYERS_APP_ID}:${FYERS_SECRET_KEY}`)
            .digest("hex");

        const response = await axios.post(`${FYERS_API_V3_BASE}/token`, {
            grant_type: "authorization_code",
            appIdHash,
            code: auth_code,
        });

        if (!response.data.access_token) throw new Error("Token not received.");

        fyersAccessToken = response.data.access_token;
        console.log("✅ Fyers access token obtained.");
        res.json({ access_token: fyersAccessToken });

    } catch (err) {
        console.error("❌ Token exchange error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- WebSocket Server ---
const server = app.listen(process.env.PORT || 10000, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 10000}`);
});

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

    fyersWS.on("open", () => console.log("✅ Fyers WebSocket connected"));

    fyersWS.on("message", (msg) => {
        try {
            const decoded = MarketData.decode(msg);
            const tickJson = JSON.stringify({ type: "tick", data: decoded });
            clientSockets.forEach(client => client.send(tickJson));
        } catch (e) {
            console.error("Decode error:", e);
        }
    });

    fyersWS.on("close", (code) => {
        console.warn(`⚠️ Fyers WS closed with code: ${code}`);
        fyersWS = null;
        clientSockets.forEach(client => client.send(JSON.stringify({ type: "error", message: "Fyers disconnected." })));
    });

    fyersWS.on("error", (err) => {
        console.error("❌ Fyers WS error:", err.message);
    });
};

wss.on("connection", (ws) => {
    console.log("🧩 Frontend connected");
    clientSockets.add(ws);

    ws.on("message", (msg) => {
        try {
            const parsed = JSON.parse(msg);

            if (parsed.type === "subscribe") {
                const tokenToUse = parsed.accessToken || fyersAccessToken;
                if (!tokenToUse) {
                    ws.send(JSON.stringify({ error: "Missing access token." }));
                    return;
                }

                connectToFyers(tokenToUse);

                const subscribe = () => {
                    if (fyersWS?.readyState === WebSocket.OPEN) {
                        const sub = { T: "SUB_DATA", symbol: [parsed.instrument] };
                        fyersWS.send(JSON.stringify(sub));
                        console.log("✅ Subscribed:", sub);
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
                console.log("🛑 Unsubscribed:", unsub);
            }
        } catch (e) {
            console.error("Message error:", e.message);
        }
    });

    ws.on("close", () => {
        console.log("❌ Frontend disconnected");
        clientSockets.delete(ws);
    });
});
