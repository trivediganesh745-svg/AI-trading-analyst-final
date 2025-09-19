import React from 'react';
import { PulseIcon } from './icons/PulseIcon';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';

interface HeaderProps {
  instrument: string;
  setInstrument: (instrument: string) => void;
  instruments: Record<string, string>;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  isLoggedIn: boolean;
  logout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  instrument,
  setInstrument,
  instruments,
  isConnected,
  connect,
  disconnect,
  isLoggedIn,
  logout
}) => {
  const cleanInstrumentName = (name: string) => name.replace(/NSE:|BSE:|-EQ|-INDEX/gi, '');

  return (
    <header className="bg-gray-800 rounded-lg shadow-lg p-3 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <PulseIcon />
        <h1 className="text-2xl font-bold text-white">Gemini AI Trading Bot</h1>
      </div>

      <div className="flex-grow flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="instrument-select" className="text-sm font-medium text-gray-400">Instrument:</label>
          <select
            id="instrument-select"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            disabled={isConnected}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.entries(instruments).map(([key, value]) => (
              <option key={key} value={value}>
                {cleanInstrumentName(value)}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={isConnected ? disconnect : connect}
          disabled={!isLoggedIn}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition duration-300 ${
            isConnected
              ? 'bg-yellow-500 hover:bg-yellow-400 text-white'
              : 'bg-green-500 hover:bg-green-400 text-white'
          } disabled:bg-gray-600 disabled:cursor-not-allowed`}
        >
          {isConnected ? <StopIcon /> : <PlayIcon />}
          <span>{isConnected ? 'Disconnect Feed' : 'Start Feed'}</span>
        </button>

        {isLoggedIn && (
            <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
                Logout
            </button>
        )}
      </div>
    </header>
  );
};
