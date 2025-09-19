import React, { useState, useEffect, useMemo } from 'react';

// Hooks
import { useFyersAuth } from './hooks/useFyersAuth';
import { useMarketData } from './hooks/useMarketData';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { useNewsFeed } from './hooks/useNewsFeed';
import { useSettings } from './hooks/useSettings';
import { getSignalExplanation } from './services/geminiService';
import { usePerformanceAnalytics } from './hooks/usePerformanceAnalytics';


// Components
import { Header } from './components/Header';
import MarketDataPanel from './components/MarketDataPanel';
import SignalPanel from './components/SignalPanel';
import MarketDepthPanel from './components/MarketDepthPanel';
import SentimentNewsPanel from './components/SentimentNewsPanel';
import TradeModal from './components/TradeModal';
import SettingsModal from './components/SettingsModal';
import ExplanationModal from './components/ExplanationModal';
import PerformanceModal from './components/PerformanceModal';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { PerformanceIcon } from './components/icons/PerformanceIcon';

// Types
import type { AISignal, Tick, Trade } from './types';
import { AuthStatus } from './types';

// Dummy instruments for the dropdown
const INSTRUMENTS = {
    'NIFTY 50': 'NSE:NIFTY50-INDEX',
    'NIFTY BANK': 'NSE:NIFTYBANK-INDEX',
    'RELIANCE': 'NSE:RELIANCE-EQ',
    'TCS': 'NSE:TCS-EQ',
};


function App() {
    // Auth
    const { authStatus, accessToken, error, login, logout, handleRedirect } = useFyersAuth();
    const isLoggedIn = authStatus === AuthStatus.AUTHENTICATED;

    // Settings
    const { settings, setSettings } = useSettings();
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    // Core State
    const [instrument, setInstrument] = useState(INSTRUMENTS['NIFTY 50']);
    const [isConnected, setIsConnected] = useState(false);
    
    // Market Data & Analysis
    const { ticks, snapshot, connect, disconnect } = useMarketData(instrument, accessToken);
    const { headlines } = useNewsFeed(instrument, isConnected ? 8000 : undefined);
    const { signal, isAnalyzing } = useGeminiAnalysis(ticks, headlines, instrument, snapshot?.ohlcv, isConnected);
    
    // Trading & Explanation
    const [tradeLog, setTradeLog] = useState<Trade[]>([]);
    const [tradeToConfirm, setTradeToConfirm] = useState<Trade | null>(null);
    const [selectedTradeForExplanation, setSelectedTradeForExplanation] = useState<Trade | null>(null);
    const [explanation, setExplanation] = useState<string>('');
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);

    // Performance Analytics
    const { metrics, equityCurve } = usePerformanceAnalytics(tradeLog);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

    useEffect(() => {
        handleRedirect();
    }, [handleRedirect]);
    
    const handleConnect = () => {
        if (isLoggedIn) {
            connect();
            setIsConnected(true);
        }
    };
    
    const handleDisconnect = () => {
        disconnect();
        setIsConnected(false);
    };

    const handleExecuteTrade = (details: { signal: AISignal; tick: Tick }) => {
        // Capture context at the moment of execution
        const newTrade: Trade = {
            ...details,
            contextTicks: [...ticks],
            contextHeadlines: [...headlines],
        };
        setTradeToConfirm(newTrade);
    };

    const handleConfirmTrade = () => {
        if (tradeToConfirm) {
            setTradeLog(prev => [tradeToConfirm, ...prev].slice(0, 100));
            setTradeToConfirm(null);
        }
    };

    const handleExplainTrade = async (trade: Trade) => {
        setSelectedTradeForExplanation(trade);
        setIsExplanationLoading(true);
        setExplanation('');
        try {
            const result = await getSignalExplanation(trade);
            setExplanation(result);
        } catch (e) {
            setExplanation("Sorry, I was unable to retrieve an explanation for this trade.");
        } finally {
            setIsExplanationLoading(false);
        }
    };

    const closeExplanationModal = () => {
        setSelectedTradeForExplanation(null);
        setExplanation('');
    };
    
    const latestTick = useMemo(() => ticks.length > 0 ? ticks[ticks.length - 1] : null, [ticks]);

    if (authStatus === AuthStatus.AUTHENTICATING) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Authenticating...</div>;
    }

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
                <h1 className="text-4xl font-bold mb-4">Gemini AI Trading Bot</h1>
                <p className="mb-8 text-gray-400">Please log in with your Fyers account to continue.</p>
                <button
                    onClick={login}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-md transition duration-300"
                >
                    Login with Fyers
                </button>
                {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 font-sans">
            <Header
                instrument={instrument}
                setInstrument={setInstrument}
                instruments={INSTRUMENTS}
                isConnected={isConnected}
                connect={handleConnect}
                disconnect={handleDisconnect}
                isLoggedIn={isLoggedIn}
                logout={logout}
            />

            <main className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="md:col-span-1 lg:col-span-1">
                    <MarketDataPanel instrument={instrument} ticks={ticks} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                     <MarketDepthPanel snapshot={snapshot} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                     <SentimentNewsPanel headlines={headlines} />
                </div>
                 <div className="md:col-span-3 lg:col-span-1">
                    <SignalPanel 
                        signal={signal} 
                        latestTick={latestTick} 
                        isAnalyzing={isAnalyzing}
                        onExecuteTrade={handleExecuteTrade}
                        tradeLog={tradeLog}
                        onExplainTrade={handleExplainTrade}
                    />
                </div>
            </main>
            
            <footer className="fixed bottom-4 right-4 flex gap-3">
                 <button
                    onClick={() => setIsPerformanceModalOpen(true)}
                    className="p-3 bg-gray-700 rounded-full shadow-lg hover:bg-cyan-600 transition"
                    title="Performance"
                >
                    <PerformanceIcon />
                </button>
                <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="p-3 bg-gray-700 rounded-full shadow-lg hover:bg-cyan-600 transition"
                    title="Settings"
                >
                    <SettingsIcon />
                </button>
            </footer>

            {tradeToConfirm && (
                <TradeModal 
                    isOpen={!!tradeToConfirm}
                    onClose={() => setTradeToConfirm(null)}
                    onConfirm={handleConfirmTrade}
                    tradeDetails={tradeToConfirm}
                    instrument={instrument.replace(/NSE:|BSE:|-EQ|-INDEX/gi, '')}
                />
            )}
            
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onSave={(newSettings) => {
                    setSettings(newSettings);
                    setIsSettingsModalOpen(false);
                }}
                currentSettings={{ ...settings }}
            />
            
            <ExplanationModal
                isOpen={!!selectedTradeForExplanation}
                onClose={closeExplanationModal}
                trade={selectedTradeForExplanation}
                explanation={explanation}
                isLoading={isExplanationLoading}
            />
            
            <PerformanceModal
                isOpen={isPerformanceModalOpen}
                onClose={() => setIsPerformanceModalOpen(false)}
                metrics={metrics}
                equityCurve={equityCurve}
            />
        </div>
    );
}

export default App;
