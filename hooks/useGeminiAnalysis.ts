import { useState, useEffect, useRef, useCallback } from 'react';
import { getGeminiAnalysis } from '../services/geminiService';
import type { Tick, NewsHeadline, AISignal, OHLCV } from '../types';

export const useGeminiAnalysis = (
    ticks: Tick[], 
    headlines: NewsHeadline[], 
    instrument: string, 
    ohlcv: OHLCV | undefined,
    isConnected: boolean, 
    analysisInterval = 5000 // Analyze every 5 seconds
) => {
  const [signal, setSignal] = useState<AISignal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performAnalysis = useCallback(async () => {
    if (ticks.length < 10 || headlines.length === 0 || !instrument || !ohlcv) {
      // Don't analyze if we don't have enough data
      if (isConnected) {
        if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = setTimeout(performAnalysis, analysisInterval);
      }
      return;
    }

    setIsAnalyzing(true);
    try {
      const newSignal = await getGeminiAnalysis(instrument, ticks, headlines, ohlcv);
      setSignal(newSignal);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
      // Schedule the next analysis
      if (isConnected) {
        if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = setTimeout(performAnalysis, analysisInterval);
      }
    }
  }, [ticks, headlines, instrument, ohlcv, isConnected, analysisInterval]);

  useEffect(() => {
    if (isConnected) {
      // Start the analysis loop when connected
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = setTimeout(performAnalysis, 1000); // Initial analysis after 1 second
    } else {
      // Stop analysis when disconnected
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      setSignal(null);
      setIsAnalyzing(false);
    }

    // Cleanup on unmount
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [isConnected, performAnalysis]);

  return { signal, isAnalyzing };
};
