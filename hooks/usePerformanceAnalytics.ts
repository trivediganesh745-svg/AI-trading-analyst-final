import { useMemo } from 'react';
import type { Trade, PerformanceMetrics, EquityDataPoint } from '../types';
import { SignalAction } from '../types';

/**
 * A custom hook to calculate performance analytics from a trade log.
 * @param tradeLog An array of completed trades.
 * @returns An object containing performance metrics and equity curve data.
 */
export const usePerformanceAnalytics = (tradeLog: Trade[]): { metrics: PerformanceMetrics, equityCurve: EquityDataPoint[] } => {
    
    const analytics = useMemo(() => {
        if (tradeLog.length === 0) {
            const emptyMetrics: PerformanceMetrics = {
                totalTrades: 0, winningTrades: 0, losingTrades: 0,
                totalNetPL: 0, winRate: 0, profitFactor: 0,
                averageWin: 0, averageLoss: 0,
            };
            return { metrics: emptyMetrics, equityCurve: [] };
        }

        // The trade log is newest-first, so we reverse it for chronological analysis
        const chronologicalTrades = [...tradeLog].reverse();
        
        let winningTrades = 0;
        let losingTrades = 0;
        let totalProfit = 0;
        let totalLoss = 0;
        let cumulativePL = 0;
        
        const equityCurve: EquityDataPoint[] = [{ tradeNumber: 0, cumulativePL: 0 }];

        chronologicalTrades.forEach((trade, index) => {
            const { signal, tick } = trade;
            
            // --- Trade Outcome Simulation ---
            // This is a simple, deterministic simulation for demonstration.
            // A real implementation would require actual trade exit data.
            // Here, we'll assume even-indexed trades are winners and odd-indexed are losers.
            const isWinner = index % 2 === 0;

            let pl = 0;
            if (signal.signal === SignalAction.BUY) {
                pl = isWinner ? (signal.target - tick.price) : (signal.stoploss - tick.price);
            } else if (signal.signal === SignalAction.SELL) {
                pl = isWinner ? (tick.price - signal.target) : (tick.price - signal.stoploss);
            }
            
            if (pl > 0) {
                winningTrades++;
                totalProfit += pl;
            } else {
                losingTrades++;
                totalLoss += Math.abs(pl); // Loss is a positive value
            }
            
            cumulativePL += pl;
            equityCurve.push({ tradeNumber: index + 1, cumulativePL });
        });
        
        const totalTrades = chronologicalTrades.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;
        const averageWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
        const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;

        const metrics: PerformanceMetrics = {
            totalTrades,
            winningTrades,
            losingTrades,
            totalNetPL: cumulativePL,
            winRate,
            profitFactor,
            averageWin,
            averageLoss,
        };

        return { metrics, equityCurve };

    }, [tradeLog]);

    return analytics;
};
