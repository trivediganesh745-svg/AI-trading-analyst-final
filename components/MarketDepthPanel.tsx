import React from 'react';
import type { MarketDepthEntry, MarketSnapshot } from '../types';

interface MarketDepthPanelProps {
  snapshot: MarketSnapshot | null;
}

const DepthRow: React.FC<{ entry: MarketDepthEntry, type: 'bid' | 'ask', maxQuantity: number }> = ({ entry, type, maxQuantity }) => {
    const isBid = type === 'bid';
    const barColor = isBid ? 'bg-green-500/20' : 'bg-red-500/20';
    const textColor = isBid ? 'text-green-400' : 'text-red-400';
    const widthPercentage = maxQuantity > 0 ? (entry.quantity / maxQuantity) * 100 : 0;

    return (
        <div className="relative h-5 flex items-center font-mono text-xs">
            <div className={`absolute top-0 bottom-0 ${barColor}`} style={{ width: `${widthPercentage}%`}}></div>
            <div className="relative grid grid-cols-3 w-full px-2">
                <span className={`col-span-1 font-bold ${textColor}`}>{entry.price.toFixed(2)}</span>
                <span className="col-span-1 text-center text-gray-200">{entry.quantity}</span>
                <span className="col-span-1 text-right text-gray-400">{entry.orders}</span>
            </div>
        </div>
    );
};


const MarketDepthVisual: React.FC<{ bids: MarketDepthEntry[], asks: MarketDepthEntry[], maxQuantity: number }> = ({ bids, asks, maxQuantity }) => {
    return (
        <div className="space-y-1">
            {asks.slice().reverse().map((ask, i) => (
                <DepthRow key={`ask-${i}`} entry={ask} type="ask" maxQuantity={maxQuantity} />
            ))}
            <div className="border-t border-gray-600 my-1"></div>
            {bids.map((bid, i) => (
                <DepthRow key={`bid-${i}`} entry={bid} type="bid" maxQuantity={maxQuantity} />
            ))}
        </div>
    );
}

const OHLCVDisplay: React.FC<{ ohlcv: MarketSnapshot['ohlcv']}> = ({ ohlcv }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mb-3 text-center">
        <div className="bg-gray-700/50 p-1 rounded">
            <span className="text-gray-400 block">Open</span>
            <span className="font-bold text-white">{ohlcv.open.toFixed(2)}</span>
        </div>
        <div className="bg-gray-700/50 p-1 rounded">
            <span className="text-gray-400 block">High</span>
            <span className="font-bold text-green-400">{ohlcv.high.toFixed(2)}</span>
        </div>
        <div className="bg-gray-700/50 p-1 rounded">
            <span className="text-gray-400 block">Low</span>
            <span className="font-bold text-red-400">{ohlcv.low.toFixed(2)}</span>
        </div>
        <div className="bg-gray-700/50 p-1 rounded">
            <span className="text-gray-400 block">Prev Close</span>
            <span className="font-bold text-gray-300">{ohlcv.close.toFixed(2)}</span>
        </div>
    </div>
);


const MarketDepthPanel: React.FC<MarketDepthPanelProps> = ({ snapshot }) => {
  const bids = snapshot?.bids || [];
  const asks = snapshot?.asks || [];
  
  const maxQuantity = Math.max(
    ...bids.map(b => b.quantity),
    ...asks.map(a => a.quantity),
    0
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-3 text-white">Market Snapshot</h2>
      {snapshot?.ohlcv && <OHLCVDisplay ohlcv={snapshot.ohlcv} />}
      <div className="flex-grow bg-gray-900/50 rounded-md p-2 overflow-y-auto relative">
         <div className="grid grid-cols-3 w-full px-2 text-xs text-gray-400 font-bold mb-1">
            <span>Price</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Orders</span>
        </div>
        {snapshot ? (
            <MarketDepthVisual bids={bids} asks={asks} maxQuantity={maxQuantity} />
        ) : (
             <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500">Waiting for market data...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketDepthPanel;
