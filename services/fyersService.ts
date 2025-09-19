import { config } from '../config';

// This is the base URL of your deployed Render proxy service.
const PROXY_BASE_URL = config.PROXY_BASE_URL;

/**
 * Fetches the Fyers login URL from the proxy.
 * @param {string} redirectUri - The URI Fyers should redirect to after login.
 */
export const getLoginUrl = async (redirectUri: string) => {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('PASTE_YOUR_RENDER_PROXY_URL_HERE')) {
    throw new Error("Proxy URL not configured. Please edit config.ts");
  }
  try {
    const response = await fetch(`${PROXY_BASE_URL}/get-login-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redirectUri }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch login URL from proxy');
    }
    return await response.json();
  } catch (error) {
    console.error("Error in getLoginUrl service:", error);
    throw error;
  }
};

/**
 * Sends the authentication code to the proxy to get an access token.
 * @param {string} authCode - The authentication code from the Fyers redirect.
 * @param {string} redirectUri - The original redirect URI used to initiate login.
 */
export const getAccessToken = async (authCode: string, redirectUri: string) => {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('PASTE_YOUR_RENDER_PROXY_URL_HERE')) {
    throw new Error("Proxy URL not configured. Please edit config.ts");
  }
  try {
    const response = await fetch(`${PROXY_BASE_URL}/get-access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authCode, redirectUri }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch access token from proxy');
    }
    return await response.json();
  } catch (error) {
    console.error("Error in getAccessToken service:", error);
    throw error;
  }
};
