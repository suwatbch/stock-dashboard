// ข้อมูลคู่เงิน Forex
export interface ForexPair {
  symbol: string; // e.g., "EUR/USD"
  base: string; // e.g., "EUR"
  quote: string; // e.g., "USD"
  name: string; // e.g., "ยูโร / ดอลลาร์สหรัฐ"
  flag1: string; // e.g., "🇪🇺"
  flag2: string; // e.g., "🇺🇸"
}

// ข้อมูลราคา Forex
export interface ForexQuote {
  symbol: string;
  bid: number; // ราคาซื้อ
  ask: number; // ราคาขาย
  price: number; // ราคาปัจจุบัน (mid)
  change: number; // การเปลี่ยนแปลง
  changePercent: number; // เปอร์เซ็นต์การเปลี่ยนแปลง
  high: number; // ราคาสูงสุดวันนี้
  low: number; // ราคาต่ำสุดวันนี้
  open: number; // ราคาเปิด
  previousClose: number; // ราคาปิดก่อนหน้า
  timestamp: string; // เวลาอัพเดท
}

// ข้อมูลสำหรับกราฟ Forex
export interface ForexChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// คู่เงินที่แสดง
export const FOREX_PAIRS: ForexPair[] = [
  {
    symbol: 'EUR/USD',
    base: 'EUR',
    quote: 'USD',
    name: 'ยูโร / ดอลลาร์สหรัฐ',
    flag1: '🇪🇺',
    flag2: '🇺🇸',
  },
  {
    symbol: 'GBP/USD',
    base: 'GBP',
    quote: 'USD',
    name: 'ปอนด์ / ดอลลาร์',
    flag1: '🇬🇧',
    flag2: '🇺🇸',
  },
  {
    symbol: 'USD/JPY',
    base: 'USD',
    quote: 'JPY',
    name: 'ดอลลาร์ / เยนญี่ปุ่น',
    flag1: '🇺🇸',
    flag2: '🇯🇵',
  },
  {
    symbol: 'BTC/USD',
    base: 'BTC',
    quote: 'USD',
    name: 'บิทคอยน์ / ดอลลาร์',
    flag1: '₿',
    flag2: '🇺🇸',
  },
  {
    symbol: 'ETH/USD',
    base: 'ETH',
    quote: 'USD',
    name: 'อีเธอเรียม / ดอลลาร์',
    flag1: 'Ξ',
    flag2: '🇺🇸',
  },
];

// ช่วงเวลากราฟ Forex (interval ของแท่งเทียน)
export type ForexTimeRange = '1m' | '5m' | '15m' | '30m' | '1h' | '1d';

// Label สำหรับแสดงผล
export const FOREX_TIMERANGE_LABELS: Record<ForexTimeRange, string> = {
  '1m': '1 นาที',
  '5m': '5 นาที',
  '15m': '15 นาที',
  '30m': '30 นาที',
  '1h': '1 ชม.',
  '1d': '1 วัน',
};

// Theme colors (shared)
export const FOREX_COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#0f3460',
  highlight: '#e94560',
  success: '#00c853',
  danger: '#ff1744',
  warning: '#ffc107',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  background: '#0f0f1a',
  card: '#1a1a2e',
  border: '#2d2d44',
  bid: '#00c853', // สีเขียวสำหรับ Bid
  ask: '#ff1744', // สีแดงสำหรับ Ask
} as const;
