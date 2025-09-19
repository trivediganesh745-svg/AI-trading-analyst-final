# Fyers Proxy Server (Render Deploy)

This is a proxy server to connect **Google AI Studio (frontend)** with **Fyers API V3**.  
It handles login, token generation, and WebSocket streaming.

---

## 🔧 Setup

1. **Clone repo & install dependencies**
   ```bash
   git clone https://github.com/<your-username>/fyers-proxy-server.git
   cd fyers-proxy-server
   npm install
POST /get-access-token
Content-Type: application/json
{
  "authCode": "AUTH_CODE_FROM_LOGIN"
}
const ws = new WebSocket("wss://<your-render-app>.onrender.com");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "subscribe", instrument: "NSE:SBIN-EQ" }));
};

ws.onmessage = (event) => {
  console.log("Market Data:", event.data);
};

