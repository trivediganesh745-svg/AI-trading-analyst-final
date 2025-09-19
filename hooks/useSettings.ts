import { useState, useEffect } from 'react';
import { TradingStrategy } from '../types';

export interface Settings {
    tradingStrategy: TradingStrategy;
    aiPersonality: string;
}

const defaultSettings: Settings = {
    tradingStrategy: TradingStrategy.INTRADAY,
    aiPersonality: `You are a helpful and concise financial analyst for a trader.
Your name is Aura. You are providing insights in real-time.
Keep your answers brief and to the point (2-3 sentences max).
Never give financial advice. Do not use markdown.`
};

export const useSettings = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const persistedValue = localStorage.getItem('appSettings');
            if (persistedValue) {
                const parsed = JSON.parse(persistedValue);
                return { ...defaultSettings, ...parsed };
            }
            return defaultSettings;
        } catch (error) {
            console.warn(`Error reading settings from localStorage:`, error);
            return defaultSettings;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (error) {
            console.warn(`Error saving settings to localStorage:`, error);
        }
    }, [settings]);

    return { settings, setSettings };
};
