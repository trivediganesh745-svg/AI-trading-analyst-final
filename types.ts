export enum AuthStatus {
  IDLE = 'IDLE',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  ERROR = 'ERROR',
}

export interface Tick {
  timestamp: number;
  price: number;
  volume: number;
}

export type Sentiment = 'Positive' | 'Negative' | 'Neutral';

export interface NewsHeadline {
  timestamp: number;
  sentiment: Sentiment;
  text: string;
}

export enum SignalAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export interface AISignal {
  signal: SignalAction;
  confidence: number;
  target: number;
  stoploss: number;
  reason: string;
}

export interface Trade {
  signal: AISignal;
  tick: Tick;
  contextTicks: Tick[];
  contextHeadlines: NewsHeadline[];
}

export interface OHLCV {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MarketDepthEntry {
    price: number;
    quantity: number;
    orders: number;
}

export interface MarketSnapshot {
    bids: MarketDepthEntry[];
    asks: MarketDepthEntry[];
    ohlcv: OHLCV;
}

export enum TradingStrategy {
    INTRADAY = 'Intraday Momentum',
    SCALPING = 'Scalping',
    SWING = 'Swing Trading',
    BALANCED = 'Balanced',
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalNetPL: number; // P/L stands for Profit/Loss
  winRate: number; // as a percentage
  profitFactor: number; // Gross Profit / Gross Loss
  averageWin: number;
  averageLoss: number;
}

export interface EquityDataPoint {
  tradeNumber: number;
  cumulativePL: number;
}
