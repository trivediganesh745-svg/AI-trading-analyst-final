const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const crypto = require("crypto");
const protobuf = require("protobufjs");
const http = require("http");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// --- Environment Variable Validation ---
const { FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URI, PORT } = process.env;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URI) {
    console.error("❌ FATAL ERROR: Missing one or more required Fyers environment variables (FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URI).");
    process.exit(1);
}

// This will be populated after successful authentication
let fyersAccessToken = null;

const FYERS_API_V3_BASE = "https://api.fyers.in/api/v3";

// --- Protobuf Definition for Fyers Market Data ---
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

// --- API Routes ---

// 1. Generate the Fyers authentication URL for the user to log in
app.get("/generate-auth-url", (req, res) => {
    const url = `${FYERS_API_V3_BASE}/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=sample_state`;
    console.log("🚀 Generated Fyers Auth URL.");
    res.json({ url });
});

// 2. Exchange the temporary auth_code for a permanent access_token
app.post("/exchange-token", async (req, res) => {
    const { auth_code } = req.body;
    if (!auth_code) {
        return res.status(400).json({ error: "Missing required parameter: auth_code." });
    }

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

        if (!response.data || !response.data.access_token) {
            throw new Error("Access token not found in Fyers response.");
        }

        fyersAccessToken = response.data.access_token;
        console.log("✅ Successfully obtained Fyers access token.");
        res.json({ access_token: fyersAccessToken });

    } catch (err) {
        console.error("❌ Error during token exchange:", err.response ? err.response.data : err.message);
        res.status(err.response?.status || 500).json({ error: "Failed to exchange Fyers authorization code for an access token. " + (err.response?.data?.message || err.message) });
    }
});

// --- Serve Frontend ---
const buildPath = path.join(process.cwd(), 'dist');
app.use(express.static(buildPath));

// For any other request, serve the index.html file
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Could not load the application.');
    }
  });
});


// --- WebSocket Server Logic ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let fyersWS = null; // Holds the single connection to Fyers
const clientSockets = new Set(); // Holds all connected frontend clients

// Function to establish and manage the connection to the Fyers WebSocket
const connectToFyers = (token) => {
    // Prevent multiple connections
    if (fyersWS && (fyersWS.readyState === WebSocket.OPEN || fyersWS.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const [appIdBase] = FYERS_APP_ID.split("-");
    const wsUrl = `wss://api.fyers.in/socket/v3/data?token=${appIdBase}:${token}&data_type=symbolData&log_level=1`;

    console.log("🔌 Connecting to Fyers WebSocket...");
    fyersWS = new WebSocket(wsUrl);

    fyersWS.on("open", () => console.log("✅ Fyers WebSocket connection established."));

    // Forward market data from Fyers to all connected frontend clients
    fyersWS.on("message", (msg) => {
        try {
            const decoded = MarketData.decode(msg);
            const tickJson = JSON.stringify({ type: "tick", data: decoded });
            clientSockets.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(tickJson)
              }
            });
        } catch (e) {
            console.error("Protobuf decode error:", e);
        }
    });

    fyersWS.on("close", (code) => {
        console.warn(`⚠️ Fyers WebSocket connection closed with code: ${code}`);
        fyersWS = null;
        clientSockets.forEach(client => client.send(JSON.stringify({ type: "error", message: "Fyers data feed disconnected." })));
    });

    fyersWS.on("error", (err) => {
        console.error("❌ Fyers WebSocket error:", err.message);
    });
};

// Handle new connections from the frontend application
wss.on("connection", (ws) => {
    console.log("🧩 Frontend client connected.");
    clientSockets.add(ws);

    // Handle messages from the frontend (subscribe/unsubscribe)
    ws.on("message", (msg) => {
        try {
            const parsed = JSON.parse(msg);
            const tokenToUse = parsed.accessToken || fyersAccessToken;

            if (parsed.type === "subscribe") {
                if (!tokenToUse) {
                    ws.send(JSON.stringify({ error: "Cannot subscribe. Fyers access token is missing." }));
                    return;
                }
                
                // Ensure connection to Fyers is active before subscribing
                connectToFyers(tokenToUse);

                const subscribe = () => {
                    if (fyersWS?.readyState === WebSocket.OPEN) {
                        const sub = { T: "SUB_DATA", symbol: [parsed.instrument] };
                        fyersWS.send(JSON.stringify(sub));
                        console.log("✅ Sent subscription request:", sub);
                    }
                };
                
                // If already connected, subscribe immediately. Otherwise, wait for the connection to open.
                if (fyersWS?.readyState === WebSocket.OPEN) {
                    subscribe();
                } else {
                    fyersWS?.once("open", subscribe);
                }
            }

            if (parsed.type === "unsubscribe" && fyersWS?.readyState === WebSocket.OPEN) {
                const unsub = { T: "UNSUB_DATA", symbol: [parsed.instrument] };
                fyersWS.send(JSON.stringify(unsub));
                console.log("🛑 Sent unsubscribe request:", unsub);
            }
        } catch (e) {
            console.error("Error processing message from frontend:", e.message);
        }
    });

    ws.on("close", () => {
        console.log("❌ Frontend client disconnected.");
        clientSockets.delete(ws);
    });
});

// --- Start Server ---
const port = PORT || 10000;
server.listen(port, () => {
    console.log(`🚀 Fyers Proxy Server listening on port ${port}`);
});
