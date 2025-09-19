import React from 'react';
import type { NewsHeadline } from '../types';

interface SentimentNewsPanelProps {
  headlines: NewsHeadline[];
}

const SentimentNewsPanel: React.FC<SentimentNewsPanelProps> = ({ headlines }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-4 flex flex-col h-full">
      <h2 className="text-xl font-bold mb-3 text-white">Market Sentiment Feed</h2>
      <div className="bg-gray-900 rounded-md p-2 flex-grow overflow-y-auto">
        {headlines.length === 0 && (
          <p className="text-gray-500 text-center p-4">Awaiting news feed...</p>
        )}
        <ul className="text-sm font-mono text-gray-400">
          {headlines.map((headline) => {
            let sentimentColor = 'text-gray-300';
            let sentimentBg = 'bg-gray-600';
            if (headline.sentiment === 'Positive') {
                sentimentColor = 'text-green-300';
                sentimentBg = 'bg-green-500/20';
            }
            if (headline.sentiment === 'Negative') {
                sentimentColor = 'text-red-300';
                sentimentBg = 'bg-red-500/20';
            }

            return (
              <li key={headline.timestamp} className="flex gap-3 p-1.5 border-b border-gray-700/50 items-start">
                <span className="text-gray-500 whitespace-nowrap">{new Date(headline.timestamp).toLocaleTimeString()}</span>
                <div className="flex-grow">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mr-2 ${sentimentBg} ${sentimentColor}`}>{headline.sentiment.toUpperCase()}</span>
                  <span className="text-gray-300">{headline.text}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SentimentNewsPanel;
