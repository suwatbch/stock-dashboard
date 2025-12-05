import { NextRequest, NextResponse } from 'next/server';

// ============ FOREX DATA FETCHING ============

// แปลง symbol เป็น Yahoo Finance format
function toYahooSymbol(symbol: string): string {
  // XAU/USD (Gold) -> GC=F (Gold Futures) หรือ XAUUSD=X
  if (symbol === 'XAU/USD') {
    return 'GC=F'; // Gold Futures
  }
  // XAG/USD (Silver) -> SI=F
  if (symbol === 'XAG/USD') {
    return 'SI=F';
  }
  // BTC/USD (Bitcoin) -> BTC-USD
  if (symbol === 'BTC/USD') {
    return 'BTC-USD';
  }
  // ETH/USD (Ethereum) -> ETH-USD
  if (symbol === 'ETH/USD') {
    return 'ETH-USD';
  }
  // คู่เงินปกติ: EUR/USD -> EURUSD=X
  return symbol.replace('/', '') + '=X';
}

// ดึงข้อมูล Forex จาก Yahoo Finance
async function getForexQuote(symbol: string) {
  const yahooSymbol = toYahooSymbol(symbol);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 30 }, // Cache 30 วินาที
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];

  if (!result) {
    throw new Error(`No data for ${symbol}`);
  }

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp || [];
  const closes = quote?.close || [];

  // หาราคาปิดก่อนหน้า
  const previousClose =
    closes.length > 1 ? closes[closes.length - 2] : meta.previousClose;
  const currentPrice = meta.regularMarketPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  // คำนวณ bid/ask (spread ประมาณ 0.0002 สำหรับ major pairs)
  const spread = currentPrice * 0.0001;
  const bid = currentPrice - spread / 2;
  const ask = currentPrice + spread / 2;

  return {
    symbol,
    bid: Number(bid.toFixed(5)),
    ask: Number(ask.toFixed(5)),
    price: Number(currentPrice.toFixed(5)),
    change: Number(change.toFixed(5)),
    changePercent: Number(changePercent.toFixed(2)),
    high: meta.regularMarketDayHigh || currentPrice,
    low: meta.regularMarketDayLow || currentPrice,
    open: meta.regularMarketOpen || previousClose,
    previousClose: Number(previousClose?.toFixed(5)) || currentPrice,
    timestamp: new Date().toISOString(),
  };
}

// ดึงข้อมูลกราฟ Forex
async function getForexTimeSeries(symbol: string, interval: string) {
  const yahooSymbol = toYahooSymbol(symbol);

  // กำหนด range ตาม interval
  let yahooRange = '1d';

  switch (interval) {
    case '1m':
      yahooRange = '7d'; // 1m รองรับสูงสุด 7 วัน
      break;
    case '5m':
    case '15m':
    case '30m':
      yahooRange = '60d'; // 5m-30m รองรับสูงสุด 60 วัน
      break;
    case '1h':
      yahooRange = '730d'; // 1h รองรับ 2 ปี
      break;
    case '1d':
      yahooRange = '1y'; // 1d รองรับไม่จำกัด
      break;
    default:
      interval = '5m';
      yahooRange = '60d';
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${yahooRange}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store', // ไม่ cache เพื่อให้ได้ข้อมูลล่าสุด
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chart for ${symbol}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];

  if (!result) {
    throw new Error(`No chart data for ${symbol}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const chartData = timestamps
    .map((ts: number, i: number) => {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];

      // ตรวจสอบว่ามีข้อมูลครบและไม่เป็น null/undefined/NaN
      if (
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        isNaN(open) ||
        isNaN(high) ||
        isNaN(low) ||
        isNaN(close) ||
        open === 0 ||
        close === 0
      ) {
        return null;
      }

      return {
        time: new Date(ts * 1000).toISOString(),
        open: Number(open.toFixed(5)),
        high: Number(high.toFixed(5)),
        low: Number(low.toFixed(5)),
        close: Number(close.toFixed(5)),
      };
    })
    .filter((d: { close: number } | null) => d !== null);

  return chartData;
}

// ============ API HANDLER ============
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') || '5m';

  try {
    switch (action) {
      case 'quote': {
        if (!symbol) {
          return NextResponse.json(
            { error: 'Symbol required' },
            { status: 400 }
          );
        }
        const quote = await getForexQuote(symbol);
        return NextResponse.json(quote);
      }

      case 'quotes': {
        // ดึงข้อมูลหลายคู่เงินพร้อมกัน
        const symbols = searchParams.get('symbols')?.split(',') || [];
        const quotes = await Promise.all(
          symbols.map(async (s) => {
            try {
              return await getForexQuote(s);
            } catch (error) {
              console.error(`Error fetching ${s}:`, error);
              return null;
            }
          })
        );
        return NextResponse.json(quotes.filter(Boolean));
      }

      case 'timeseries': {
        if (!symbol) {
          return NextResponse.json(
            { error: 'Symbol required' },
            { status: 400 }
          );
        }
        const chartData = await getForexTimeSeries(symbol, interval);
        return NextResponse.json({ data: chartData });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Forex API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
