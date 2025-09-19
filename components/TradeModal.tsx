import React, { useEffect } from 'react';
import type { AISignal, Tick } from '../types';
import { SignalAction } from '../types';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tradeDetails: { signal: AISignal; tick: Tick };
  instrument: string;
}

const TradeModal: React.FC<TradeModalProps> = ({ isOpen, onClose, onConfirm, tradeDetails, instrument }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const { signal, tick } = tradeDetails;
  const isBuy = signal.signal === SignalAction.BUY;
  const signalColor = isBuy ? 'text-green-400' : 'text-red-400';
  const buttonColor = isBuy ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md m-4 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h2 id="modal-title" className="text-2xl font-bold text-white">
            Confirm Trade
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4">
          <p className="text-sm text-gray-400">You are about to execute the following trade:</p>
          <div className="mt-4 space-y-3 rounded-lg bg-gray-900/50 p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-300">Action:</span>
              <span className={`font-bold text-lg ${signalColor}`}>{signal.signal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-300">Instrument:</span>
              <span className="font-mono text-white">{instrument}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-300">Entry Price:</span>
              <span className="font-mono text-white">{tick.price.toFixed(2)}</span>
            </div>
             <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-300">Target:</span>
              <span className="font-mono text-green-400">{signal.target.toFixed(2)}</span>
            </div>
             <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-300">Stoploss:</span>
              <span className="font-mono text-red-400">{signal.stoploss.toFixed(2)}</span>
            </div>
          </div>
           <p className="text-xs text-gray-500 mt-4 italic">AI Reason: "{signal.reason}"</p>
        </div>
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`py-2 px-6 rounded-md text-white font-bold transition ${buttonColor}`}
          >
            Confirm {signal.signal}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeModal;
