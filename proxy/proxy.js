// proxy.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const protobuf = require("protobufjs");

const app = express();
app.use(cors());
app.use(express.json());

// --- Fyers Credentials from Environment Variables ---
// 🔑 Set these in your Render Dashboard -> Environment tab
// Example: FYERS_APP_ID = "ABC12DE3F-100"
// Example: FYERS_SECRET_KEY = "S3CR3TK3Y"
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY;

let fyersAccessToken = null; // Global variable to store the access token

// --- Protobuf Definition for Fyers WebSocket ---
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

// --- API Endpoints ---
app.get("/", (req, res) => res.send("✅ Fyers Proxy Server is running."));

/**
 * @route POST /direct-login
 * @description Performs the entire automated Fyers login flow.
 */
app.post("/direct-login", async (req, res) => {
    const { fyersId, pin, totpSecret } = req.body;

    if (!fyersId || !pin || !totpSecret) {
        return res.status(400).json({ error: "Fyers ID, PIN, and TOTP Secret are required." });
    }
    if (!FYERS_APP_ID || !FYERS_SECRET_KEY) {
        return res.status(500).json({ error: "Server is not configured. Missing App ID or Secret Key." });
    }
    
    try {
        const appIdBase = FYERS_APP_ID.split('-')[0];

        // Step 1: Send Login OTP (to get request_key)
        const otpResponse = await axios.post("https://api-t1.fyers.in/api/v3/send_login_otp", {
            fy_id: fyersId,
            app_id: appIdBase,
            app_type: "web"
        }, { headers: { 'Content-Type': 'application/json' }});
        
        if (otpResponse.data.s !== 'ok' || !otpResponse.data.request_key) {
            throw new Error(otpResponse.data.message || "Failed to get request_key from send_login_otp.");
        }
        const requestKey1 = otpResponse.data.request_key;

        // Step 2: Verify TOTP
        const totp = authenticator.generate(totpSecret);
        const totpResponse = await axios.post("https://api-t1.fyers.in/api/v3/verify_totp", {
            request_key: requestKey1,
            otp: totp
        }, { headers: { 'Content-Type': 'application/json' }});

        if (totpResponse.data.s !== 'ok' || !totpResponse.data.request_key) {
            throw new Error(totpResponse.data.message || "TOTP verification failed.");
        }
        const requestKey2 = totpResponse.data.request_key;

        // Step 3: Verify PIN
        const pinResponse = await axios.post("https://api-t1.fyers.in/api/v3/verify_pin", {
            request_key: requestKey2,
            identity_type: "pin",
            identifier: pin,
        }, { headers: { 'Content-Type': 'application/json' }});

        if (pinResponse.data.s !== 'ok' || !pinResponse.data.request_key) {
            throw new Error(pinResponse.data.message || "PIN verification failed.");
        }
        const finalRequestKey = pinResponse.data.request_key;

        // Step 4: Exchange for Final Access Token
        const appIdHash = crypto.createHash('sha256').update(`${FYERS_APP_ID}:${FYERS_SECRET_KEY}`).digest('hex');
        const tokenResponse = await axios.post("https://api-t1.fyers.in/api/v3/auth/access-token", {
            request_key: finalRequestKey,
            app_id_hash: appIdHash,
        }, { headers: { 'Content-Type': 'application/json' }});
        
        if (tokenResponse.data.s !== 'ok' || !tokenResponse.data.access_token) {
            throw new Error(tokenResponse.data.message || "Failed to retrieve final access token.");
        }
        
        fyersAccessToken = tokenResponse.data.access_token;
        
        console.log("✅ Successfully obtained Fyers access token.");
        res.json({ access_token: fyersAccessToken });

    } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || "An unknown error occurred during login.";
        console.error("Fyers direct login error:", errorMsg);
        res.status(500).json({ error: errorMsg });
    }
});

// --- WebSocket Proxy Logic ---
const server = app.listen(process.env.PORT || 10000, () => {
    console.log(`🚀 Proxy server running on port ${process.env.PORT || 10000}`);
});

const wss = new WebSocket.Server({ server });

let fyersWS = null;
const clientSockets = new Set();

const connectToFyers = (token) => {
    if (fyersWS && (fyersWS.readyState === WebSocket.OPEN || fyersWS.readyState === WebSocket.CONNECTING)) {
        return; // Connection already open or in progress
    }

    const [appIdBase] = FYERS_APP_ID.split('-');
    const wsUrl = `wss://api-ws.fyers.in/socket/v3/data?token=${appIdBase}:${token}&data_type=symbolData&log_level=1`;

    fyersWS = new WebSocket(wsUrl);

    fyersWS.on("open", () => console.log("✅ Connected to Fyers WebSocket"));

    fyersWS.on("message", (msg) => {
        try {
            const decoded = MarketData.decode(msg);
            const tick = { type: "tick", data: decoded };
            const tickJson = JSON.stringify(tick);
            clientSockets.forEach(client => client.send(tickJson));
        } catch (e) {
            console.error("Protobuf decoding error:", e);
        }
    });

    fyersWS.on("close", (code) => {
        console.log(`❌ Disconnected from Fyers WebSocket with code: ${code}`);
        fyersWS = null;
        // Optionally notify clients of disconnection
        clientSockets.forEach(client => client.send(JSON.stringify({ type: "error", message: "Fyers connection lost."})));
    });

    fyersWS.on("error", (err) => console.error("❌ Fyers WS error:", err.message));
};

wss.on("connection", (ws) => {
    console.log("Frontend client connected to proxy");
    clientSockets.add(ws);

    ws.on("message", (msg) => {
        try {
            const parsedMsg = JSON.parse(msg);
            
            if (parsedMsg.type === "subscribe") {
                const tokenToUse = parsedMsg.accessToken || fyersAccessToken;
                if (!tokenToUse) {
                    ws.send(JSON.stringify({ error: "No access token available for subscription." }));
                    return;
                }
                
                connectToFyers(tokenToUse);

                const subscribeAction = () => {
                     if (fyersWS && fyersWS.readyState === WebSocket.OPEN) {
                         const sub = { T: "SUB_DATA", symbol: [parsedMsg.instrument] };
                         fyersWS.send(JSON.stringify(sub));
                         console.log("Sent subscription to Fyers:", sub);
                    } else {
                         console.log("Waiting for Fyers connection to subscribe...");
                    }
                };

                if (fyersWS && fyersWS.readyState === WebSocket.OPEN) {
                    subscribeAction();
                } else {
                    fyersWS.once('open', subscribeAction);
                }
                
            } else if (parsedMsg.type === "unsubscribe") {
                if (fyersWS && fyersWS.readyState === WebSocket.OPEN) {
                    const unsub = { T: "UNSUB_DATA", symbol: [parsedMsg.instrument] };
                    fyersWS.send(JSON.stringify(unsub));
                    console.log("Sent unsubscribe to Fyers:", unsub);
                }
            }
        } catch (e) {
            console.error("Error processing message from client:", e);
        }
    });

    ws.on("close", () => {
        console.log("Frontend client disconnected from proxy");
        clientSockets.delete(ws);
    });
});

