import React, { useState, useEffect } from 'react';
import { TradingStrategy } from '../types';

export interface Settings {
    tradingStrategy: TradingStrategy;
    aiPersonality: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Omit<Settings, 'instrument'>) => void;
  currentSettings: Settings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const [settings, setSettings] = useState<Omit<Settings, 'instrument'>>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

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

  const handleSave = () => {
    onSave(settings);
  };
  
  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(s => ({ ...s, tradingStrategy: e.target.value as TradingStrategy }));
  };

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSettings(s => ({...s, aiPersonality: e.target.value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      aria-labelledby="settings-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-lg m-4 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h2 id="settings-modal-title" className="text-2xl font-bold text-white">
            Settings
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

        <div className="mt-4 border-t border-gray-700 pt-4 space-y-6">
            <div>
                <label htmlFor="strategy" className="block text-sm font-medium text-gray-300 mb-1">AI Trading Strategy</label>
                <select 
                    id="strategy"
                    value={settings.tradingStrategy}
                    onChange={handleStrategyChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                >
                    {Object.values(TradingStrategy).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="personality" className="block text-sm font-medium text-gray-300 mb-1">AI Chat Personality (System Instruction)</label>
                <textarea
                    id="personality"
                    value={settings.aiPersonality}
                    onChange={handlePersonalityChange}
                    rows={4}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                    placeholder="e.g., You are a helpful and concise financial analyst..."
                />
            </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="py-2 px-6 rounded-md text-white font-bold transition bg-cyan-600 hover:bg-cyan-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
