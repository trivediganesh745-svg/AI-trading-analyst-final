import { useState, useEffect, useCallback } from 'react';
import { getLoginUrl, getAccessToken } from '../services/fyersService';
import { AuthStatus } from '../types';

export const useFyersAuth = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.IDLE);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('fyers_access_token');
    if (token) {
      setAccessToken(token);
      setAuthStatus(AuthStatus.AUTHENTICATED);
    }
  }, []);

  const login = useCallback(async () => {
    setAuthStatus(AuthStatus.AUTHENTICATING);
    setError(null);
    try {
      // The redirect URI is now dynamically determined and sent to the proxy
      const redirectUri = window.location.origin + window.location.pathname;
      const { loginUrl } = await getLoginUrl(redirectUri);
      window.location.href = loginUrl;
    } catch (err) {
      console.error("Error getting login URL:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to start login. Is the proxy running? Error: ${message}`);
      setAuthStatus(AuthStatus.ERROR);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fyers_access_token');
    setAccessToken(null);
    setAuthStatus(AuthStatus.IDLE);
  }, []);

  const handleRedirect = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');

    if (authCode && authStatus !== AuthStatus.AUTHENTICATED) {
      setAuthStatus(AuthStatus.AUTHENTICATING);
      try {
        const redirectUri = window.location.origin + window.location.pathname;
        const { access_token } = await getAccessToken(authCode, redirectUri);
        if (access_token) {
          localStorage.setItem('fyers_access_token', access_token);
          setAccessToken(access_token);
          setAuthStatus(AuthStatus.AUTHENTICATED);
        } else {
          throw new Error("Access token not received from proxy.");
        }
      } catch (err) {
        console.error("Error exchanging auth code:", err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Authentication failed. Error: ${message}`);
        setAuthStatus(AuthStatus.ERROR);
      } finally {
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [authStatus]);

  return { authStatus, accessToken, error, login, logout, handleRedirect };
};
