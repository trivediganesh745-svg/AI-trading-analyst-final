import React from 'react';
import type { Tick } from '../types';

// A simple SVG-based price chart component
const PriceChart: React.FC<{ ticks: Tick[] }> = ({ ticks }) => {
    if (ticks.length < 2) return <div className="w-full h-full bg-gray-900/50 rounded-md flex items-center justify-center text-gray-500">Not enough data for chart</div>;
    
    const width = 300;
    const height = 150;
    
    const prices = ticks.map(t => t.price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;

    const points = ticks.map((tick, index) => {
        const x = (index / (ticks.length - 1)) * width;
        const y = height - ((tick.price - minPrice) / (priceRange || 1)) * height;
        return `${x},${y}`;
    }).join(' ');
    
    const lastPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const strokeColor = lastPrice >= firstPrice ? '#4ade80' : '#f87171'; // green-400 or red-400

    return (
        <div className="w-full h-full bg-gray-900/50 rounded-md p-2">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
                <polyline
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    points={points}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    )
}

interface MarketDataPanelProps {
  instrument: string;
  ticks: Tick[];
}

const MarketDataPanel: React.FC<MarketDataPanelProps> = ({ instrument, ticks }) => {
  const latestTick = ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const previousTick = ticks.length > 1 ? ticks[ticks.length - 2] : null;

  const getPriceChange = () => {
    if (!latestTick || !previousTick) {
      return { change: 0, percentage: 0, direction: 'neutral' as const };
    }
    const change = latestTick.price - previousTick.price;
    const percentage = (change / previousTick.price) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    return { change, percentage, direction };
  };
  
  const { change, percentage, direction } = getPriceChange();

  const priceColorClass = direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-gray-300';
  const priceDirectionIcon = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';


  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col h-full">
      <div className="flex justify-between items-baseline mb-2">
        <h2 className="text-xl font-bold text-white">
            {instrument.replace(/NSE:|BSE:|-EQ|-INDEX/gi, '')}
        </h2>
        {latestTick && (
             <span className="text-xs text-gray-400">
                Last updated: {new Date(latestTick.timestamp).toLocaleTimeString()}
             </span>
        )}
      </div>
      
      {latestTick ? (
        <>
            <div className="mb-4">
                <p className={`text-4xl font-bold font-mono ${priceColorClass}`}>
                    {priceDirectionIcon} {latestTick.price.toFixed(2)}
                </p>
                <p className={`text-sm font-mono ${priceColorClass}`}>
                   {change.toFixed(2)} ({percentage.toFixed(2)}%)
                </p>
            </div>
            
            <div className="flex-grow">
                <PriceChart ticks={ticks} />
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mt-4 text-gray-400 font-mono">
                <div>Volume: <span className="text-white">{latestTick.volume}</span></div>
            </div>
        </>
      ) : (
        <div className="flex-grow flex items-center justify-center">
            <p className="text-gray-500">Waiting for market data...</p>
        </div>
      )}
    </div>
  );
};

export default MarketDataPanel;
