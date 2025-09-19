import { useState, useRef, useCallback, useEffect } from 'react';
import type { Tick, MarketSnapshot } from '../types';
import { config } from '../config';

// This is the base URL of your deployed Render proxy service.
const PROXY_BASE_URL = config.PROXY_BASE_URL;

const getWebSocketUrl = () => {
    if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('PASTE_YOUR_RENDER_PROXY_URL_HERE')) {
        // Return a non-functional URL if not configured, the error will be caught on connect attempt.
        return null;
    }
    if (PROXY_BASE_URL.startsWith('https://')) {
        return PROXY_BASE_URL.replace('https://', 'wss://');
    }
    if (PROXY_BASE_URL.startsWith('http://')) {
        return PROXY_BASE_URL.replace('http://', 'ws://');
    }
    // Fallback for cases where protocol isn't specified, though unlikely for Render URLs.
    return `wss://${PROXY_BASE_URL}`;
}

export const useMarketData = (instrument: string, accessToken: string | null) => {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      console.log('WebSocket disconnected.');
    }
  }, []);

  const connect = useCallback(() => {
    if (!accessToken || wsRef.current) return;

    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
        console.error("WebSocket connection failed: Proxy URL is not configured in config.ts");
        return;
    }

    disconnect(); 

    console.log(`Connecting WebSocket to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected. Subscribing to instrument...');
      setTicks([]); 
      setSnapshot(null);
      const subMessage = {
        type: 'subscribe',
        instrument,
        accessToken
      };
      ws.send(JSON.stringify(subMessage));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'tick') {
          const newTick: Tick = message.data;
          setTicks(prev => [...prev.slice(-199), newTick]);
        } else if (message.type === 'snapshot') {
          const newSnapshot: MarketSnapshot = message.data;
          setSnapshot(newSnapshot);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed.');
      wsRef.current = null;
    };
  }, [instrument, accessToken, disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { ticks, snapshot, connect, disconnect };
};
