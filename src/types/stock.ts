// ข้อมูลราคาหุ้นปัจจุบัน
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  latestTradingDay: string;
}

// ผลการค้นหาหุ้น
export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

// หุ้นใน Watchlist
export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
}

// ข้อมูลสำหรับกราฟ
export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ช่วงเวลากราฟ
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

// Theme colors
export const COLORS = {
  primary: '#1a1a2e', // Dark blue
  secondary: '#16213e', // Darker blue
  accent: '#0f3460', // Medium blue
  highlight: '#e94560', // Red/Pink
  success: '#00c853', // Green
  danger: '#ff1744', // Red
  warning: '#ffc107', // Yellow
  text: '#ffffff', // White
  textSecondary: '#94a3b8', // Gray
  background: '#0f0f1a', // Very dark
  card: '#1a1a2e', // Card background
  border: '#2d2d44', // Border
} as const;
