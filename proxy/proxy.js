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

// Credentials from env
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY) {
    console.error("❌ Missing FYERS_APP_ID or FYERS_SECRET_KEY in env");
    process.exit(1);
}

let fyersAccessToken = null;

// Protobuf setup for websocket messages
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

app.get("/", (req, res) => res.send("✅ Fyers Proxy Server is running."));

/**
 * @route POST /direct-login
 */
app.post("/direct-login", async (req, res) => {
    const { fyersId, pin, totpSecret } = req.body;

    if (!fyersId || !pin || !totpSecret) {
        return res.status(400).json({ error: "Fyers ID, PIN, and TOTP Secret are required." });
    }

    try {
        const [appIdBase, appTypeSuffix] = FYERS_APP_ID.split('-');
        // appTypeSuffix may be needed depending on new API

        // === Replace these endpoint URLs with the ones from Fyers API v3 ===
        const SEND_OTP_URL = "https://api‑tX.fyers.in/api/v3/send_login_otp";         // <<< check actual
        const VERIFY_TOTP_URL = "https://api‑tX.fyers.in/api/v3/verify_totp";         // <<< check
        const VERIFY_PIN_URL = "https://api‑tX.fyers.in/api/v3/verify_pin";           // <<< check
        const TOKEN_URL = "https://api‑tX.fyers.in/api/v3/auth/access-token";         // <<< check

        console.log("🔍 Sending OTP to:", SEND_OTP_URL);
        const otpResponse = await axios.post(SEND_OTP_URL, {
            fy_id: fyersId,
            app_id: appIdBase,
            app_type: "web"
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("🔍 OTP Response:", otpResponse.status, otpResponse.data);

        if (otpResponse.status !== 200 || otpResponse.data.s !== 'ok' || !otpResponse.data.request_key) {
            throw new Error(otpResponse.data.message || `send_login_otp failed with status ${otpResponse.status}`);
        }
        const requestKey1 = otpResponse.data.request_key;

        console.log("🔍 Verifying TOTP at:", VERIFY_TOTP_URL);
        const totp = authenticator.generate(totpSecret);
        const totpResponse = await axios.post(VERIFY_TOTP_URL, {
            request_key: requestKey1,
            otp: totp
        }, { headers: { 'Content-Type': 'application/json' }});
        console.log("🔍 TOTP Response:", totpResponse.status, totpResponse.data);

        if (totpResponse.status !== 200 || totpResponse.data.s !== 'ok' || !totpResponse.data.request_key) {
            throw new Error(totpResponse.data.message || `verify_totp failed with status ${totpResponse.status}`);
        }
        const requestKey2 = totpResponse.data.request_key;

        console.log("🔍 Verifying PIN at:", VERIFY_PIN_URL);
        const pinResponse = await axios.post(VERIFY_PIN_URL, {
            request_key: requestKey2,
            identity_type: "pin",
            identifier: pin
        }, { headers: { 'Content-Type': 'application/json' }});
        console.log("🔍 PIN Response:", pinResponse.status, pinResponse.data);

        if (pinResponse.status !== 200 || pinResponse.data.s !== 'ok' || !pinResponse.data.request_key) {
            throw new Error(pinResponse.data.message || `verify_pin failed with status ${pinResponse.status}`);
        }
        const finalRequestKey = pinResponse.data.request_key;

        console.log("🔍 Exchanging for access token at:", TOKEN_URL);
        const appIdHash = crypto.createHash('sha256').update(`${FYERS_APP_ID}:${FYERS_SECRET_KEY}`).digest('hex');
        const tokenResponse = await axios.post(TOKEN_URL, {
            request_key: finalRequestKey,
            app_id_hash: appIdHash
        }, { headers: { 'Content-Type': 'application/json' }});
        console.log("🔍 Token Response:", tokenResponse.status, tokenResponse.data);

        if (tokenResponse.status !== 200 || tokenResponse.data.s !== 'ok' || !tokenResponse.data.access_token) {
            throw new Error(tokenResponse.data.message || `access-token request failed with status ${tokenResponse.status}`);
        }

        fyersAccessToken = tokenResponse.data.access_token;
        console.log("✅ Successfully obtained Fyers access token.");
        return res.json({ access_token: fyersAccessToken });

    } catch (err) {
        console.error("Fyers direct login error:", err.toString());
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || err.message;
        return res.status(status).json({ error: message });
    }
});

// WebSocket section remains mostly same but with defensive checks
const server = app.listen(process.env.PORT || 10000, () => {
    console.log(`🚀 Proxy server running on port ${process.env.PORT || 10000}`);
});
const wss = new WebSocket.Server({ server });

let fyersWS = null;
const clientSockets = new Set();

const connectToFyers = (token) => {
    if (fyersWS && (fyersWS.readyState === WebSocket.OPEN || fyersWS.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const [appIdBase, appTypeSuffix] = FYERS_APP_ID.split('-');
    // The WebSocket URL format may also have changed in v3 — verify from Fyers docs
    const wsUrl = `wss://api-ws.fyers.in/socket/v3/data?token=${appIdBase}:${token}&data_type=symbolData&log_level=1`;

    console.log("🔍 Connecting to Fyers WebSocket:", wsUrl);
    fyersWS = new WebSocket(wsUrl);

    fyersWS.on("open", () => {
        console.log("✅ Connected to Fyers WebSocket");
    });

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
        console.warn(`❌ Disconnected from Fyers WebSocket with code: ${code}`);
        fyersWS = null;
        clientSockets.forEach(client => client.send(JSON.stringify({ type: "error", message: "Fyers connection lost." })));
    });

    fyersWS.on("error", (err) => {
        console.error("❌ Fyers WS error:", err.message);
    });
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
                        const sub = { T: "SUB_DATA", symbol: [ parsedMsg.instrument ] };
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
                    const unsub = { T: "UNSUB_DATA", symbol: [ parsedMsg.instrument ] };
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


