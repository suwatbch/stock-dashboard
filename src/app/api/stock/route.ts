import { NextRequest, NextResponse } from 'next/server';

// API Keys (optional - for higher rate limits)
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'demo';
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'demo';

// ============ YAHOO FINANCE (Primary - No API key needed) ============
async function yahooSearch(symbol: string) {
  // ค้นหาทั้งแบบปกติและหุ้นไทย (.BK)
  const searches = [
    `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&quotesCount=10&newsCount=0`,
    `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}.BK&quotesCount=5&newsCount=0`,
  ];

  const results = await Promise.all(
    searches.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.quotes || [];
      } catch {
        return [];
      }
    })
  );

  // รวมผลลัพธ์และกรอง duplicate
  const allQuotes = [...results[1], ...results[0]]; // ให้หุ้นไทยขึ้นก่อน
  const seen = new Set<string>();
  const uniqueQuotes = allQuotes.filter((q: Record<string, string>) => {
    if (!q.symbol || seen.has(q.symbol)) return false;
    seen.add(q.symbol);
    return true;
  });

  if (uniqueQuotes.length === 0) {
    throw new Error('ไม่พบหุ้นที่ค้นหา');
  }

  const bestMatches = uniqueQuotes.map((q: Record<string, string>) => ({
    '1. symbol': q.symbol,
    '2. name': q.shortname || q.longname || q.symbol,
    '3. type': q.quoteType || 'Equity',
    '4. region': q.exchange || 'US',
    '8. currency': q.currency || 'USD',
  }));

  return { source: 'yahoo', bestMatches };
}

async function yahooQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response.ok) throw new Error('Yahoo quote failed');

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('ไม่พบข้อมูลหุ้น');

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0];
  const prevClose =
    meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
  const price = meta.regularMarketPrice;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

  return {
    source: 'yahoo',
    'Global Quote': {
      '01. symbol': symbol,
      '02. open': quote?.open?.[0] || meta.regularMarketOpen || price,
      '03. high': quote?.high?.[0] || meta.regularMarketDayHigh || price,
      '04. low': quote?.low?.[0] || meta.regularMarketDayLow || price,
      '05. price': price,
      '06. volume': quote?.volume?.[0] || meta.regularMarketVolume || 0,
      '07. latest trading day': new Date().toISOString().split('T')[0],
      '08. previous close': prevClose,
      '09. change': change.toFixed(4),
      '10. change percent': changePercent.toFixed(4) + '%',
    },
  };
}

async function yahooTimeSeries(symbol: string, type: string) {
  let range = '1mo';
  let interval = '1d';

  if (type === 'intraday') {
    range = '1d';
    interval = '5m';
  } else if (type === 'intraday1d1m') {
    // 1 วัน แบบ 1 นาที (Yahoo รองรับ 1m ได้ถึง ~7 วัน)
    range = '1d';
    interval = '1m';
  } else if (type === 'intraday5d1m') {
    // 5 วัน แบบ 1 นาที (Yahoo รองรับ 1m ได้ถึง ~7 วัน)
    range = '5d';
    interval = '1m';
  } else if (type === 'intraday5d15m') {
    // 5 วัน แบบ 15 นาที (Yahoo รองรับ 15m ได้ถึง ~60 วัน)
    range = '5d';
    interval = '15m';
  } else if (type === 'intraday5d5m') {
    // 5 วัน แบบ 5 นาที (เหมาะกับ 1W ที่ต้องการละเอียด)
    range = '5d';
    interval = '5m';
  } else if (type === 'intraday5d') {
    // ข้อมูลรายชั่วโมงสำหรับ 5D - ให้เห็นความผันผวนมากขึ้น
    range = '5d';
    interval = '60m'; // 1 ชั่วโมง
  } else if (type === 'intraday5d30m') {
    // 5 วัน แบบ 30 นาที (Yahoo รองรับ 30m ได้ถึง ~60 วัน)
    range = '5d';
    interval = '30m';
  } else if (type === 'intraday6mo') {
    // 6 เดือน แบบรายชั่วโมง (จะไป aggregate เป็น 2 ชั่วโมงที่ฝั่ง UI)
    range = '6mo';
    interval = '60m';
  } else if (type === 'intraday30m') {
    // ข้อมูล 30 นาที สำหรับ 1 เดือน (Yahoo รองรับ 30m ได้ถึง ~60 วัน)
    range = '1mo';
    interval = '30m';
  } else if (type === 'intraday1m') {
    // ทดสอบ: ข้อมูลรายชั่วโมงสำหรับ 1 เดือน
    range = '1mo';
    interval = '60m';
  } else if (type === 'intraday3m') {
    // ทดสอบ: ข้อมูลรายชั่วโมงสำหรับ 3 เดือน
    range = '3mo';
    interval = '60m';
  } else if (type === 'daily10y') {
    // ข้อมูลรายวันย้อนหลัง 10 ปี (ใช้สำหรับ ALL แบบ sample วัน 1/15)
    range = '10y';
    interval = '1d';
  } else if (type === 'daily') {
    range = '5y'; // ใช้ 5y สำหรับข้อมูลรายวัน (max จะคืนข้อมูลเป็น monthly)
    interval = '1d';
  } else if (type === 'weekly') {
    range = 'max'; // เพิ่มเป็น max สำหรับข้อมูลระยะยาว
    interval = '1wk';
  } else if (type === 'monthly') {
    range = 'max'; // ใช้ max สำหรับข้อมูลทั้งหมด
    interval = '1mo';
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response.ok) throw new Error('Yahoo timeseries failed');

  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('ไม่มีข้อมูลกราฟ');

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};

  const timeSeries: Record<string, Record<string, string>> = {};
  const isIntradayLike = type.startsWith('intraday');
  timestamps.forEach((ts: number, i: number) => {
    const date = new Date(ts * 1000);
    const dateStr = isIntradayLike
      ? date.toISOString().replace('T', ' ').substring(0, 19)
      : date.toISOString().split('T')[0];

    if (quotes.close?.[i] !== null && quotes.close?.[i] !== undefined) {
      timeSeries[dateStr] = {
        '1. open': String(quotes.open?.[i] || 0),
        '2. high': String(quotes.high?.[i] || 0),
        '3. low': String(quotes.low?.[i] || 0),
        '4. close': String(quotes.close?.[i] || 0),
        '5. volume': String(quotes.volume?.[i] || 0),
      };
    }
  });

  let key = 'Time Series (Daily)';
  if (type === 'intraday' || type === 'intraday5d5m')
    key = 'Time Series (5min)';
  else if (type === 'intraday1d1m' || type === 'intraday5d1m')
    key = 'Time Series (1min)';
  else if (type === 'intraday5d15m') key = 'Time Series (15min)';
  else if (type === 'intraday5d30m' || type === 'intraday30m')
    key = 'Time Series (30min)';
  else if (
    type === 'intraday5d' ||
    type === 'intraday1m' ||
    type === 'intraday3m' ||
    type === 'intraday6mo'
  )
    key = 'Time Series (60min)';
  else if (type === 'weekly') key = 'Weekly Time Series';
  else if (type === 'monthly') key = 'Monthly Time Series';

  return { source: 'yahoo', [key]: timeSeries };
}

// ============ FINNHUB (Backup) ============
async function finnhubSearch(symbol: string) {
  const url = `https://finnhub.io/api/v1/search?q=${symbol}&token=${FINNHUB_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Finnhub search failed');

  const data = await response.json();
  if (!data.result || data.result.length === 0) {
    throw new Error('Finnhub no results');
  }

  const bestMatches = data.result.map((r: Record<string, string>) => ({
    '1. symbol': r.symbol,
    '2. name': r.description,
    '3. type': r.type || 'Equity',
    '4. region': 'US',
    '8. currency': 'USD',
  }));

  return { source: 'finnhub', bestMatches };
}

async function finnhubQuote(symbol: string) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Finnhub quote failed');

  const data = await response.json();
  if (!data.c || data.c === 0) throw new Error('Finnhub no data');

  const change = data.c - data.pc;
  const changePercent = data.pc ? (change / data.pc) * 100 : 0;

  return {
    source: 'finnhub',
    'Global Quote': {
      '01. symbol': symbol,
      '02. open': data.o,
      '03. high': data.h,
      '04. low': data.l,
      '05. price': data.c,
      '06. volume': 0,
      '07. latest trading day': new Date().toISOString().split('T')[0],
      '08. previous close': data.pc,
      '09. change': change.toFixed(4),
      '10. change percent': changePercent.toFixed(4) + '%',
    },
  };
}

// ============ TWELVE DATA (Backup) ============
async function twelveDataSearch(symbol: string) {
  const url = `https://api.twelvedata.com/symbol_search?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Twelve Data search failed');

  const data = await response.json();
  if (!data.data || data.data.length === 0) {
    throw new Error('Twelve Data no results');
  }

  const bestMatches = data.data.map((r: Record<string, string>) => ({
    '1. symbol': r.symbol,
    '2. name': r.instrument_name,
    '3. type': r.instrument_type || 'Equity',
    '4. region': r.exchange || 'US',
    '8. currency': r.currency || 'USD',
  }));

  return { source: 'twelvedata', bestMatches };
}

async function twelveDataQuote(symbol: string) {
  const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Twelve Data quote failed');

  const data = await response.json();
  if (data.code || !data.close) throw new Error('Twelve Data no data');

  const change = parseFloat(data.change || '0');
  const changePercent = parseFloat(data.percent_change || '0');

  return {
    source: 'twelvedata',
    'Global Quote': {
      '01. symbol': symbol,
      '02. open': data.open,
      '03. high': data.high,
      '04. low': data.low,
      '05. price': data.close,
      '06. volume': data.volume || 0,
      '07. latest trading day':
        data.datetime?.split(' ')[0] || new Date().toISOString().split('T')[0],
      '08. previous close': data.previous_close,
      '09. change': change.toFixed(4),
      '10. change percent': changePercent.toFixed(4) + '%',
    },
  };
}

async function twelveDataTimeSeries(symbol: string, type: string) {
  let interval = '1day';
  let outputsize = 30;

  if (type === 'intraday') {
    interval = '5min';
    outputsize = 78;
  } else if (type === 'daily') {
    interval = '1day';
    outputsize = 500; // เพิ่มจาก 100 เป็น 500 เพื่อให้ได้ data points มากขึ้น
  } else if (type === 'weekly') {
    interval = '1week';
    outputsize = 260; // เพิ่มจาก 52 เป็น 260 (5 ปี)
  } else if (type === 'monthly') {
    interval = '1month';
    outputsize = 120; // เพิ่มจาก 60 เป็น 120 (10 ปี)
  }

  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error('Twelve Data timeseries failed');

  const data = await response.json();
  if (data.code || !data.values) throw new Error('Twelve Data no timeseries');

  const timeSeries: Record<string, Record<string, string>> = {};
  data.values.forEach((v: Record<string, string>) => {
    timeSeries[v.datetime] = {
      '1. open': v.open,
      '2. high': v.high,
      '3. low': v.low,
      '4. close': v.close,
      '5. volume': v.volume || '0',
    };
  });

  let key = 'Time Series (Daily)';
  if (type === 'intraday') key = 'Time Series (5min)';
  else if (type === 'weekly') key = 'Weekly Time Series';
  else if (type === 'monthly') key = 'Monthly Time Series';

  return { source: 'twelvedata', [key]: timeSeries };
}

// ============ FALLBACK LOGIC ============
async function tryWithFallback<T>(
  providers: Array<() => Promise<T>>,
  providerNames: string[]
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < providers.length; i++) {
    try {
      const result = await providers[i]();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('ไม่สามารถดึงข้อมูลได้');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const type = searchParams.get('type') || 'quote';
  const provider = searchParams.get('provider');

  if (!symbol) {
    return NextResponse.json({ error: 'กรุณาระบุ symbol' }, { status: 400 });
  }

  try {
    let data;

    // Optional: force a single provider (useful for testing)
    if (provider === 'yahoo') {
      if (type === 'search') data = await yahooSearch(symbol);
      else if (type === 'quote') data = await yahooQuote(symbol);
      else data = await yahooTimeSeries(symbol, type);
      return NextResponse.json(data);
    }

    if (type === 'search') {
      // ค้นหา: Yahoo -> Finnhub -> TwelveData
      data = await tryWithFallback(
        [
          () => yahooSearch(symbol),
          () => finnhubSearch(symbol),
          () => twelveDataSearch(symbol),
        ],
        ['Yahoo', 'Finnhub', 'TwelveData']
      );
    } else if (type === 'quote') {
      // ราคา: Yahoo -> Finnhub -> TwelveData
      data = await tryWithFallback(
        [
          () => yahooQuote(symbol),
          () => finnhubQuote(symbol),
          () => twelveDataQuote(symbol),
        ],
        ['Yahoo', 'Finnhub', 'TwelveData']
      );
    } else {
      // กราฟ: Yahoo -> TwelveData
      data = await tryWithFallback(
        [
          () => yahooTimeSeries(symbol, type),
          () => twelveDataTimeSeries(symbol, type),
        ],
        ['Yahoo', 'TwelveData']
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'ไม่สามารถดึงข้อมูลได้',
      },
      { status: 500 }
    );
  }
}
