import { useState, useEffect, useRef, useCallback } from 'react';
import type { NewsHeadline, Sentiment } from '../types';

const SIMPLIFIED_HEADLINES: Record<Sentiment, string[]> = {
    Positive: [
      "Strong Earnings Report for {INSTRUMENT}",
      "Analyst Upgrade: 'Strong Buy' on {INSTRUMENT}",
      "Major Partnership Announcement",
      "Positive Economic Data Boosts Market",
      "High Institutional Buying Volume in {INSTRUMENT}",
    ],
    Negative: [
      "Regulatory Concerns Impacting {INSTRUMENT}",
      "Key Executive Departure at Major Firm",
      "Earnings Miss for Sector Peer",
      "Broad Market Sell-Off",
      "Increased Competition in the Sector",
    ],
    Neutral: [
      "Awaiting Inflation Data",
      "Low Volume / Indecision in {INSTRUMENT}",
      "Divided Analyst Outlook",
      "Market Holding Pattern",
      "Price Consolidation Phase for {INSTRUMENT}",
    ],
};

const getRandomHeadline = (instrument: string): NewsHeadline => {
    const sentimentKeys = Object.keys(SIMPLIFIED_HEADLINES) as Sentiment[];
    const randomSentiment = sentimentKeys[Math.floor(Math.random() * sentimentKeys.length)];
    
    const headlines = SIMPLIFIED_HEADLINES[randomSentiment];
    const randomHeadlineText = headlines[Math.floor(Math.random() * headlines.length)];
    
    const cleanInstrument = instrument.replace(/NSE:|BSE:|-EQ|-INDEX/gi, '');
    
    return {
        timestamp: Date.now(),
        sentiment: randomSentiment,
        text: randomHeadlineText.replace('{INSTRUMENT}', cleanInstrument),
    };
}

export const useNewsFeed = (instrument: string, interval: number | undefined = 8000, maxHeadlines = 20) => {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateHeadline = useCallback(() => {
    setHeadlines(prev => [getRandomHeadline(instrument), ...prev].slice(0, maxHeadlines));
  }, [instrument, maxHeadlines]);

  useEffect(() => {
    // Generate one immediately
    setHeadlines([getRandomHeadline(instrument)]);
    
    // Clear any existing interval
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }
    
    // Set up new interval if needed
    if (interval && interval > 0) {
        intervalRef.current = setInterval(() => {
            generateHeadline();
        }, interval);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, generateHeadline, instrument]);

  return { headlines };
};
