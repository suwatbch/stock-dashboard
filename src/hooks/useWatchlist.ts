'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WatchlistItem, StockQuote } from '@/types/stock';

const WATCHLIST_KEY = 'stock_watchlist';
const WATCHLIST_QUOTES_KEY = 'stock_watchlist_quotes';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<
    Map<string, StockQuote>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const watchlistRef = useRef<WatchlistItem[]>([]);

  // Sync ref กับ state
  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  // โหลด watchlist และ quotes cache จาก localStorage เมื่อ mount
  useEffect(() => {
    // โหลด watchlist
    const savedWatchlist = localStorage.getItem(WATCHLIST_KEY);
    if (savedWatchlist) {
      try {
        const parsed = JSON.parse(savedWatchlist);
        setWatchlist(parsed);
      } catch {
        console.error('Failed to parse watchlist from localStorage');
      }
    }

    // โหลด quotes cache
    const savedQuotes = localStorage.getItem(WATCHLIST_QUOTES_KEY);
    if (savedQuotes) {
      try {
        const parsed = JSON.parse(savedQuotes);
        // แปลง object กลับเป็น Map
        const quotesMap = new Map<string, StockQuote>(Object.entries(parsed));
        setWatchlistQuotes(quotesMap);
      } catch {
        console.error('Failed to parse watchlist quotes from localStorage');
      }
    }

    setIsInitialized(true);
  }, []);

  // บันทึก watchlist ลง localStorage เมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    }
  }, [watchlist, isInitialized]);

  // บันทึก quotes ลง localStorage เมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    if (isInitialized && watchlistQuotes.size > 0) {
      // แปลง Map เป็น object เพื่อ stringify
      const quotesObj = Object.fromEntries(watchlistQuotes);
      localStorage.setItem(WATCHLIST_QUOTES_KEY, JSON.stringify(quotesObj));
    }
  }, [watchlistQuotes, isInitialized]);

  // เพิ่มหุ้นเข้า watchlist
  const addToWatchlist = useCallback((symbol: string, name: string) => {
    setWatchlist((prev) => {
      // ตรวจสอบว่ามีอยู่แล้วหรือไม่
      if (prev.some((item) => item.symbol === symbol)) {
        return prev;
      }
      return [
        ...prev,
        {
          symbol,
          name,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  // ลบหุ้นออกจาก watchlist
  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
    setWatchlistQuotes((prev) => {
      const newMap = new Map(prev);
      newMap.delete(symbol);
      return newMap;
    });

    // อัพเดต localStorage ทันที
    const savedQuotes = localStorage.getItem(WATCHLIST_QUOTES_KEY);
    if (savedQuotes) {
      try {
        const parsed = JSON.parse(savedQuotes);
        delete parsed[symbol];
        localStorage.setItem(WATCHLIST_QUOTES_KEY, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }
  }, []);

  // ตรวจสอบว่าหุ้นอยู่ใน watchlist หรือไม่
  const isInWatchlist = useCallback(
    (symbol: string) => {
      return watchlist.some((item) => item.symbol === symbol);
    },
    [watchlist]
  );

  // ดึงข้อมูลราคาหุ้นใน watchlist ทั้งหมด
  const refreshWatchlistQuotes = useCallback(async () => {
    const currentWatchlist = watchlistRef.current;
    if (currentWatchlist.length === 0) return;

    setLoading(true);

    // ดึงข้อมูลทีละตัวเพื่อไม่ให้โดน rate limit
    for (const item of currentWatchlist) {
      try {
        const response = await fetch(
          `/api/stock?symbol=${item.symbol}&type=quote`
        );
        const data = await response.json();

        if (data['Global Quote']) {
          const quote = data['Global Quote'];
          const stockQuote: StockQuote = {
            symbol: quote['01. symbol'],
            name: item.name,
            price: parseFloat(quote['05. price']) || 0,
            change: parseFloat(quote['09. change']) || 0,
            changePercent:
              parseFloat(quote['10. change percent']?.replace('%', '')) || 0,
            open: parseFloat(quote['02. open']) || 0,
            high: parseFloat(quote['03. high']) || 0,
            low: parseFloat(quote['04. low']) || 0,
            volume: parseInt(quote['06. volume']) || 0,
            previousClose: parseFloat(quote['08. previous close']) || 0,
            latestTradingDay: quote['07. latest trading day'] || '',
          };

          // อัพเดต state ทีละตัว ใช้ functional update เพื่อหลีกเลี่ยง dependency
          setWatchlistQuotes((prev) => {
            const newMap = new Map(prev);
            newMap.set(item.symbol, stockQuote);
            return newMap;
          });
        }

        // รอ 500ms ระหว่างแต่ละ request
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to fetch quote for ${item.symbol}:`, error);
      }
    }

    setLoading(false);
  }, []); // ใช้ ref แทน dependency เพื่อป้องกัน re-create function

  // เรียงลำดับ watchlist ใหม่
  const reorderWatchlist = useCallback((newOrder: WatchlistItem[]) => {
    setWatchlist(newOrder);
  }, []);

  return {
    watchlist,
    watchlistQuotes,
    loading,
    isInitialized,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    refreshWatchlistQuotes,
    reorderWatchlist,
  };
}
