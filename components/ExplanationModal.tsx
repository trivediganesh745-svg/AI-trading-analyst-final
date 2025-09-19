import React, { useEffect } from 'react';
import type { Trade } from '../types';
import { SignalAction } from '../types';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: Trade | null;
  explanation: string;
  isLoading: boolean;
}

const ExplanationModal: React.FC<ExplanationModalProps> = ({ isOpen, onClose, trade, explanation, isLoading }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen || !trade) return null;

  const isBuy = trade.signal.signal === SignalAction.BUY;
  const signalColor = isBuy ? 'text-green-400' : 'text-red-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-2xl m-4 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-bold text-white">AI Trade Explanation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition" aria-label="Close modal">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4 space-y-4">
            {/* Trade Details Section */}
            <div>
                <h3 className="font-semibold text-gray-300 mb-2">Original Trade Signal:</h3>
                <div className="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center text-sm">
                    <div className={signalColor}>
                        <span className="font-bold text-lg">{trade.signal.signal}</span>
                        <span className="font-mono"> @ {trade.tick.price.toFixed(2)}</span>
                    </div>
                    <div className="text-gray-400">
                        <span>Target: <span className="font-mono text-white">{trade.signal.target.toFixed(2)}</span></span>
                    </div>
                    <div className="text-gray-400">
                        <span>Stoploss: <span className="font-mono text-white">{trade.signal.stoploss.toFixed(2)}</span></span>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 italic">Original Reason: "{trade.signal.reason}"</p>
            </div>
            
            {/* Explanation Section */}
            <div>
                <h3 className="font-semibold text-gray-300 mb-2">AI Post-Trade Analysis:</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg min-h-[100px] flex items-center justify-center">
                    {isLoading ? (
                         <div className="flex items-center gap-2 text-cyan-400">
                            <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-cyan-400 animate-spin"></div>
                            <span>Aura is analyzing the historical data...</span>
                        </div>
                    ) : (
                        <p className="text-gray-300 whitespace-pre-wrap">{explanation}</p>
                    )}
                </div>
            </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="py-2 px-6 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplanationModal;
