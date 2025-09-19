# Gemini AI Trading Bot

This application uses a real Fyers API login to stream live market data and provide AI-driven trading signals using the Gemini API.

It requires a backend proxy to handle the Fyers authentication and WebSocket data connection securely.

## Full Step-by-Step Guide to Deploying the Proxy on Render

This guide will walk you through deploying the necessary proxy server as a "Web Service" on Render's free tier.

### Prerequisites

*   A Render Account: Sign up for free at render.com.
*   A GitHub Account: Your project code must be in a GitHub repository.
*   Your Fyers App ID and Secret Key: From your Fyers developer account.

### Step 1: Create the Proxy Files on GitHub

In your project repository, create a new folder named `proxy`. Inside this `proxy` folder, create the two files provided (`package.json` and `proxy.js`).

### Step 2: Deploy the Proxy to Render

1.  Log in to your Render Dashboard.
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account and select your project repository.
4.  Configure the Web Service with these exact settings:
    *   **Name:** `fyers-proxy` (or any name you like).
    *   **Root Directory:** `proxy` (This is **extremely important**. It tells Render to only look inside your proxy folder).
    *   **Environment:** `Node`.
    *   **Build Command:** `npm install`.
    *   **Start Command:** `node proxy.js`.
    *   **Instance Type:** Select the **Free** tier.
5.  Scroll down and click **Advanced**.
6.  Click **Add Environment Variable** twice to create two "secret" variables:
    *   **Key:** `FYERS_APP_ID`
    *   **Value:** `PASTE_YOUR_ACTUAL_FYERS_APP_ID_HERE`
    *   **Key:** `FYERS_SECRET_KEY`
    *   **Value:** `PASTE_YOUR_ACTUAL_FYERS_SECRET_KEY_HERE`
7.  Click **Create Web Service**. Render will now build and deploy your proxy.
8.  Once it's live, Render will give you a public URL at the top of the page, like `https://fyers-proxy.onrender.com`. **Copy this full URL.**

### Step 3: Connect Your Frontend to the Deployed Proxy

1.  In your project's root directory, open the `config.ts` file.
2.  Paste the URL you copied from Render into the `PROXY_BASE_URL` field.
3.  Save the file and push the change to GitHub.
