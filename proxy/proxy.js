const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Load credentials from environment variables
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET_KEY = process.env.FYERS_SECRET_KEY;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY) {
    console.error("FATAL: FYERS_APP_ID and FYERS_SECRET_KEY must be set in the environment.");
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// --- AUTHENTICATION ROUTES ---
app.post('/get-login-url', (req, res) => {
    const { redirectUri } = req.body;
    if (!redirectUri) {
        return res.status(400).json({ error: 'redirectUri is required' });
    }

    // ✅ Updated to API v3
    const loginUrl = `https://api.fyers.in/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=sample_state`;
    console.log('Generated Login URL:', loginUrl);
    res.json({ loginUrl });
});

app.post('/get-access-token', async (req, res) => {
    const { authCode, redirectUri } = req.body;
    if (!authCode) {
        return res.status(400).json({ error: 'authCode is required' });
    }

    try {
        const response = await axios.post("https://api.fyers.in/api/v3/token", {
            client_id: FYERS_APP_ID,
            secret_key: FYERS_SECRET_KEY,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code: authCode
        });
        console.log('Access Token Response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        res.status(500).json({ error: error.message || 'Failed to get access token' });
    }
});

// Create an HTTP server from the Express app
const server = http.createServer(app);

// --- WEBSOCKET SERVER FOR MARKET DATA ---
const wsServer = new WebSocket.Server({ server });

wsServer.on('connection', (ws) => {
    console.log('Client connected to WebSocket proxy');
    let fyersSocket = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'subscribe' && data.instrument && data.accessToken) {
                console.log(`Subscribing to ${data.instrument}`);

                if (fyersSocket) fyersSocket.close();

                // ✅ Updated to API v3
                const url = `wss://api.fyers.in/socket/v3/data?token=${FYERS_APP_ID}:${data.accessToken}&data_type=symbolData`;
                fyersSocket = new WebSocket(url);

                fyersSocket.on('open', () => {
                    console.log('Connected to Fyers WebSocket');
                });

                fyersSocket.on('message', (msg) => {
                    try {
                        const parsed = JSON.parse(msg);
                        ws.send(JSON.stringify({ type: 'tick', data: parsed }));
                    } catch (err) {
                        console.error("Invalid WebSocket message:", msg);
                    }
                });

                fyersSocket.on('error', (err) => console.error('Fyers WebSocket Error:', err));
                fyersSocket.on('close', () => console.log('Fyers WebSocket disconnected.'));
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket proxy');
        if (fyersSocket) fyersSocket.close();
    });
});

server.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});
