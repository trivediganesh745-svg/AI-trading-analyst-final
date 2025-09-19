import React, { useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PerformanceMetrics, EquityDataPoint } from '../types';

interface PerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: PerformanceMetrics;
  equityCurve: EquityDataPoint[];
}

const StatCard: React.FC<{ label: string, value: string | number, className?: string }> = ({ label, value, className = ''}) => (
    <div className="bg-gray-700/50 p-3 rounded-lg text-center">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${className}`}>{value}</p>
    </div>
);


const PerformanceModal: React.FC<PerformanceModalProps> = ({ isOpen, onClose, metrics, equityCurve }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;
  
  const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;
  const plColor = metrics.totalNetPL >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-4xl m-4 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-bold text-white">Performance Analytics</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition" aria-label="Close modal">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4">
            {metrics.totalTrades > 0 ? (
            <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Total Net P/L" value={formatCurrency(metrics.totalNetPL)} className={plColor} />
                    <StatCard label="Win Rate" value={`${metrics.winRate.toFixed(1)}%`} className={metrics.winRate >= 50 ? 'text-green-400' : 'text-red-400'} />
                    <StatCard label="Total Trades" value={metrics.totalTrades} className="text-white" />
                    <StatCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} className="text-white" />
                </div>

                {/* Equity Curve Chart */}
                <div className="h-64 w-full bg-gray-900/50 p-2 rounded-lg">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurve} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                            <XAxis dataKey="tradeNumber" stroke="#5A5A5A" fontSize={12} />
                            <YAxis stroke="#5A5A5A" fontSize={12} domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #3C3C3C' }} 
                                labelStyle={{ color: '#ffffff' }}
                            />
                            <Area type="monotone" dataKey="cumulativePL" stroke="#06b6d4" fillOpacity={1} fill="url(#colorUv)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </>
            ) : (
                <div className="h-80 flex items-center justify-center">
                    <p className="text-gray-500">No trades logged yet. Execute some trades to see performance analytics.</p>
                </div>
            )}
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

export default PerformanceModal;
