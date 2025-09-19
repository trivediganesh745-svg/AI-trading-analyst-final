import React from 'react';
import type { AISignal, Tick, Trade } from '../types';
import { SignalAction } from '../types';

interface SignalPanelProps {
  signal: AISignal | null;
  latestTick: Tick | null;
  isAnalyzing: boolean;
  onExecuteTrade: (details: { signal: AISignal; tick: Tick }) => void;
  tradeLog: Trade[];
  onExplainTrade: (trade: Trade) => void;
}

const SignalPanel: React.FC<SignalPanelProps> = ({ signal, latestTick, isAnalyzing, onExecuteTrade, tradeLog, onExplainTrade }) => {
    
    const getSignalColor = (sig: SignalAction | undefined) => {
        switch(sig) {
            case SignalAction.BUY: return 'bg-green-500/10 border-green-500 text-green-400';
            case SignalAction.SELL: return 'bg-red-500/10 border-red-500 text-red-400';
            default: return 'bg-gray-700/20 border-gray-600 text-gray-400';
        }
    };

    const handleExecute = () => {
        if (signal && latestTick && signal.signal !== SignalAction.HOLD) {
            onExecuteTrade({ signal, tick: latestTick });
        }
    };

    const isTradeable = signal && signal.signal !== SignalAction.HOLD;

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col h-full">
            {/* AI Signal Section */}
            <div>
                <div className="flex justify-between items-baseline mb-3">
                    <h2 className="text-xl font-bold text-white">AI Analyst Signal</h2>
                    {isAnalyzing && (
                        <div className="flex items-center gap-2 text-xs text-cyan-400">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                            <span>Analyzing...</span>
                        </div>
                    )}
                </div>
                
                {signal ? (
                    <div className={`p-4 rounded-lg border-l-4 ${getSignalColor(signal.signal)}`}>
                        <div className="flex justify-between items-center mb-2">
                           <h3 className={`text-2xl font-bold`}>{signal.signal}</h3>
                           <p className="text-sm">Conf: {(signal.confidence * 100).toFixed(0)}%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-center mb-2">
                            <div className="bg-gray-900/50 p-1 rounded-md">
                                <p className="text-xs text-gray-400">Target</p>
                                <p className="font-mono font-bold text-white">{signal.target.toFixed(2)}</p>
                            </div>
                            <div className="bg-gray-900/50 p-1 rounded-md">
                                <p className="text-xs text-gray-400">Stop-Loss</p>
                                <p className="font-mono font-bold text-white">{signal.stoploss.toFixed(2)}</p>
                            </div>
                        </div>
                         <p className="text-xs text-gray-400 italic">"{signal.reason}"</p>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center bg-gray-900/20 rounded-lg">
                        <p className="text-gray-500">{isAnalyzing ? 'Generating initial signal...' : 'Waiting for market data...'}</p>
                    </div>
                )}
            </div>
            
            <button
                onClick={handleExecute}
                disabled={!isTradeable || !latestTick}
                className="w-full mt-4 py-2 text-md font-bold rounded-md transition duration-300 bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
                Execute Trade
            </button>

            {/* Trade Log Section */}
            <div className="mt-4 flex-grow flex flex-col">
                <h3 className="text-lg font-semibold text-gray-300">Trade Log</h3>
                <div className="bg-gray-900/50 rounded-md p-2 mt-2 flex-grow overflow-y-auto">
                    {tradeLog.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                           <p className="text-sm text-gray-500">No trades executed yet.</p>
                        </div>
                    ) : (
                        <ul className="text-sm font-mono text-gray-400 space-y-2">
                            {tradeLog.map((trade, index) => (
                                <li key={index} className="p-2 rounded-md bg-gray-700/50">
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold ${trade.signal.signal === SignalAction.BUY ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.signal.signal} @ {trade.tick.price.toFixed(2)}
                                        </span>
                                        <span className="text-xs text-gray-500">{new Date(trade.tick.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <button 
                                        onClick={() => onExplainTrade(trade)}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline mt-1"
                                    >
                                        Explain this trade
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SignalPanel;
