'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  AreaData,
  AreaSeries,
} from 'lightweight-charts';
import {
  Box,
  Container,
  Typography,
  Paper,
  IconButton,
  Button,
  ButtonGroup,
  Alert,
  Skeleton,
  Divider,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as AccessTimeIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useWatchlist } from '@/hooks/useWatchlist';
import { StockQuote, TimeRange } from '@/types/stock';
import ThemeRegistry from '../ThemeRegistry';
import StockLogo from '../common/StockLogo';

interface StockDetailContentProps {
  symbol: string;
  stockName: string;
}

// Chart colors
const CHART_COLORS = {
  background: '#1a1a2e',
  card: '#16213e',
  border: '#0f3460',
  highlight: '#e94560',
  text: '#eaeaea',
  textSecondary: '#a0a0a0',
  success: '#22c55e', // เขียว
  danger: '#ef4444', // แดง
};

export default function StockDetailContent({
  symbol,
  stockName,
}: StockDetailContentProps) {
  const router = useRouter();

  const { addToWatchlist, removeFromWatchlist, isInWatchlist, isInitialized } =
    useWatchlist();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenChartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const fullscreenChartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const fullscreenSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const timeRangeRef = useRef<TimeRange>('1D'); // ref สำหรับใช้ใน chart localization

  // State สำหรับ tooltip แสดงราคาและเวลาเมื่อ touch
  const [touchPrice, setTouchPrice] = useState<number | null>(null);
  const [touchTime, setTouchTime] = useState<string | null>(null);
  const [touchPosition, setTouchPosition] = useState<{
    x: number;
    y: number;
    chartWidth: number;
    chartHeight: number;
  } | null>(null);

  const [stockData, setStockData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [apiSource, setApiSource] = useState<string>('Yahoo Finance');
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenChartReady, setFullscreenChartReady] = useState(false);

  // State สำหรับ change ตามช่วงเวลาที่เลือก
  const [periodChange, setPeriodChange] = useState<number>(0);
  const [periodChangePercent, setPeriodChangePercent] = useState<number>(0);
  const [periodIsPositive, setPeriodIsPositive] = useState<boolean>(true);

  // Mount check and mobile detection
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 600);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  // ข้อมูลตลาดหลักทรัพย์
  const getMarketInfo = (sym: string) => {
    const markets: Record<
      string,
      { flag: string; country: string; exchange: string; color: string }
    > = {
      // หุ้นไทย
      '.BK': {
        flag: '🇹🇭',
        country: 'หุ้นไทย',
        exchange: 'SET',
        color: '#e94560',
      },
      // หุ้นสหรัฐฯ - ตรวจจากชื่อหุ้นที่รู้จัก
    };

    // ตรวจสอบหุ้นไทย
    if (sym.endsWith('.BK') || sym.includes('.BK')) {
      return {
        flag: '🇹🇭',
        country: 'หุ้นไทย',
        exchange: 'SET',
        color: '#e94560',
      };
    }

    // หุ้นสหรัฐฯ - ส่วนใหญ่เป็น NASDAQ หรือ NYSE
    // สามารถเพิ่ม mapping เฉพาะหุ้นได้
    const nasdaqStocks = [
      'AAPL',
      'MSFT',
      'GOOGL',
      'GOOG',
      'AMZN',
      'META',
      'NVDA',
      'TSLA',
      'AVGO',
      'COST',
      'NFLX',
      'AMD',
      'INTC',
      'QCOM',
      'CSCO',
      'ADBE',
      'TXN',
      'AMAT',
      'PYPL',
      'MU',
    ];
    const nyseStocks = [
      'JPM',
      'V',
      'JNJ',
      'WMT',
      'PG',
      'MA',
      'UNH',
      'HD',
      'DIS',
      'BAC',
      'XOM',
      'CVX',
      'KO',
      'PFE',
      'ABBV',
      'MRK',
      'PEP',
      'TMO',
      'ABT',
      'NKE',
      'BRK-A',
      'BRK-B',
    ];

    if (nasdaqStocks.includes(sym.toUpperCase())) {
      return {
        flag: '🇺🇸',
        country: 'หุ้นสหรัฐฯ',
        exchange: 'NASDAQ',
        color: '#4ade80',
      };
    }
    if (nyseStocks.includes(sym.toUpperCase())) {
      return {
        flag: '🇺🇸',
        country: 'หุ้นสหรัฐฯ',
        exchange: 'NYSE',
        color: '#60a5fa',
      };
    }

    // Default สำหรับหุ้นที่ไม่รู้จัก - สมมติเป็น US
    return {
      flag: '🇺🇸',
      country: 'หุ้นสหรัฐฯ',
      exchange: 'NASDAQ',
      color: '#4ade80',
    };
  };

  const marketInfo = getMarketInfo(symbol);

  // แปลงชื่อ API source
  const getProviderName = (source: string) => {
    switch (source) {
      case 'yahoo':
        return 'Yahoo Finance';
      case 'finnhub':
        return 'Finnhub';
      case 'twelvedata':
        return 'Twelve Data';
      default:
        return 'Yahoo Finance';
    }
  };

  // ตรวจสอบ watchlist เมื่อ initialized
  useEffect(() => {
    if (isInitialized) {
      setInWatchlist(isInWatchlist(symbol));
    }
  }, [isInitialized, symbol, isInWatchlist]);

  // ฟอร์แมตตัวเลข
  const formatNumber = (num: number, decimals = 2) => {
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // ฟอร์แมตตัวเลขใหญ่
  const formatLargeNumber = (num: number) => {
    if (isNaN(num)) return '-';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  // ฟอร์แมตเวลา
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok',
    }).format(date);
  };

  // โหลดข้อมูลหุ้น
  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/stock?symbol=${symbol}&type=quote&provider=yahoo`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error(`ไม่พบข้อมูลหุ้น ${symbol}`);
      }

      const stockQuote: StockQuote = {
        symbol: quote['01. symbol'] || symbol,
        name: stockName,
        price: parseFloat(quote['05. price'] || '0'),
        change: parseFloat(quote['09. change'] || '0'),
        changePercent: parseFloat(
          (quote['10. change percent'] || '0').replace('%', '')
        ),
        volume: parseInt(quote['06. volume'] || '0'),
        high: parseFloat(quote['03. high'] || '0'),
        low: parseFloat(quote['04. low'] || '0'),
        open: parseFloat(quote['02. open'] || '0'),
        previousClose: parseFloat(quote['08. previous close'] || '0'),
        latestTradingDay: quote['07. latest trading day'] || '',
      };

      setStockData(stockQuote);
      setLastUpdate(new Date());
      if (data.source) {
        setApiSource(getProviderName(data.source));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [symbol, stockName]);

  // โหลดข้อมูลกราฟ
  const fetchChartData = useCallback(async () => {
    try {
      setChartLoading(true);
      // อัพเดท ref สำหรับใช้ใน chart localization
      timeRangeRef.current = timeRange;

      // เลือก type ตามช่วงเวลา
      // - 1D: intraday (5min intervals)
      // - 1W: intraday5d (60min intervals) - รายชั่วโมงเพื่อให้เห็นความผันผวน
      // - 1M, 6M, 1Y, 5Y: daily
      // - ALL: weekly (เพื่อให้ได้ข้อมูลย้อนหลังมากกว่า 5 ปี)
      let type = 'daily';
      if (timeRange === '1D') {
        type = 'intraday';
      } else if (timeRange === '1W') {
        type = 'intraday5d'; // ข้อมูลรายชั่วโมง 5 วัน
      } else if (timeRange === 'ALL') {
        type = 'weekly'; // ใช้ weekly สำหรับ ALL เพื่อให้ได้ข้อมูล max
      }

      const response = await fetch(
        `/api/stock?symbol=${symbol}&type=${type}&provider=yahoo`
      );
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Parse data based on type
      let timeSeries: Record<string, Record<string, string>>;
      if (type === 'intraday') {
        timeSeries = data['Time Series (5min)'];
      } else if (type === 'intraday5d') {
        timeSeries = data['Time Series (60min)'];
      } else if (type === 'weekly') {
        timeSeries = data['Weekly Time Series'];
      } else {
        timeSeries = data['Time Series (Daily)'];
      }

      if (!timeSeries || Object.keys(timeSeries).length === 0) {
        // ไม่มีข้อมูล - แสดงกราฟเปล่า ไม่ throw error
        console.warn('ไม่มีข้อมูลกราฟสำหรับ', symbol);
        setChartLoading(false);
        return;
      }

      // Convert to chart data
      // ใช้ timestamp สำหรับทุก type เพื่อให้ timeFormatter ทำงานได้
      const chartData: AreaData<Time>[] = Object.entries(timeSeries)
        .map(([date, values]) => {
          let timestamp: number;
          if (type === 'intraday' || type === 'intraday5d') {
            // Parse datetime and add Thai timezone offset (7 hours) for chart display
            const parsedDate = new Date(date.replace(' ', 'T') + 'Z');
            const thaiOffset = 7 * 60 * 60; // 7 hours in seconds
            timestamp = Math.floor(parsedDate.getTime() / 1000) + thaiOffset;
          } else {
            // Daily/Weekly: parse date string to timestamp
            const parsedDate = new Date(date + 'T00:00:00Z');
            timestamp = Math.floor(parsedDate.getTime() / 1000);
          }
          return {
            time: timestamp as Time,
            value: parseFloat(values['4. close'] || '0'),
          };
        })
        .filter((d) => !isNaN(d.value) && d.value > 0)
        .sort((a, b) => {
          if (typeof a.time === 'number' && typeof b.time === 'number') {
            return a.time - b.time;
          }
          return (a.time as string).localeCompare(b.time as string);
        });

      // Filter data based on timeRange
      // หมายเหตุ: ใช้ trading days (วันทำการ) ไม่ใช่ calendar days
      // 1 ปี ≈ 252 วันทำการ, 1 เดือน ≈ 21 วันทำการ
      // Intraday: ~78 intervals per day (5min intervals for 6.5 hours)
      let filteredData = chartData;
      if (timeRange === '1D') {
        filteredData = chartData.slice(-78); // 5min intervals for 1 day
      } else if (timeRange === '1W') {
        // ใช้ข้อมูลรายชั่วโมง 5 วัน (ประมาณ 5 x 7 = 35 ชั่วโมงต่อวัน x 5 = ~40 จุดข้อมูล)
        filteredData = chartData; // ใช้ทั้งหมดที่ API ส่งมา
      } else if (timeRange === '1M') {
        filteredData = chartData.slice(-21); // ~21 วันทำการ (1 เดือน)
      } else if (timeRange === '3M') {
        filteredData = chartData.slice(-63); // ~63 วันทำการ (3 เดือน)
      } else if (timeRange === '6M') {
        filteredData = chartData.slice(-126); // ~126 วันทำการ (6 เดือน)
      } else if (timeRange === '1Y') {
        filteredData = chartData.slice(-252); // ~252 วันทำการ (1 ปี)
      } else if (timeRange === '5Y') {
        filteredData = chartData.slice(-252 * 5); // ~1260 วันทำการ (5 ปี)
      } else if (timeRange === 'ALL') {
        // ALL ใช้ weekly data - จำกัดไม่เกิน 10 ปี (52 สัปดาห์ x 10 = 520)
        filteredData = chartData.slice(-520);
      }

      // Update chart
      if (filteredData.length > 0) {
        // ตรวจสอบทิศทางราคา: จุดเริ่มต้น vs จุดสุดท้าย
        const firstPrice = filteredData[0]?.value || 0;
        const lastPrice = filteredData[filteredData.length - 1]?.value || 0;
        const isUptrend = lastPrice >= firstPrice;

        // คำนวณ change และ changePercent ตามช่วงเวลาที่เลือก
        const change = lastPrice - firstPrice;
        const changePercent =
          firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

        // อัพเดท state
        setPeriodChange(change);
        setPeriodChangePercent(changePercent);
        setPeriodIsPositive(isUptrend);

        const chartOptions = {
          lineColor: isUptrend ? CHART_COLORS.success : CHART_COLORS.danger,
          topColor: isUptrend
            ? 'rgba(34, 197, 94, 0.4)'
            : 'rgba(239, 68, 68, 0.4)',
          bottomColor: isUptrend
            ? 'rgba(34, 197, 94, 0.05)'
            : 'rgba(239, 68, 68, 0.05)',
        };

        // คำนวณ barSpacing ที่เหมาะสมตามจำนวนข้อมูลและความกว้างของ chart
        const dataLength = filteredData.length;
        const chartWidth = chartContainerRef.current?.clientWidth || 800;

        // คำนวณ barSpacing แบบ dynamic เพื่อให้เต็มพื้นที่
        // สูตร: (chartWidth - padding) / dataLength
        let barSpacing = Math.floor(
          (chartWidth - 40) / Math.max(dataLength, 1)
        );

        // จำกัด barSpacing ไม่ให้มากหรือน้อยเกินไป
        if (barSpacing > 150) barSpacing = 150;
        if (barSpacing < 3) barSpacing = 3;

        // Update main chart
        if (seriesRef.current) {
          seriesRef.current.applyOptions(chartOptions);
          seriesRef.current.setData(filteredData);

          // ปรับ time scale settings ตามจำนวนข้อมูล
          chartRef.current?.timeScale().applyOptions({
            barSpacing: barSpacing,
            rightOffset: 0, // ไม่เว้นที่ว่างด้านขวา
          });

          // บังคับ re-render time scale เพื่อให้ timeFormatter ใช้ค่า timeRange ใหม่
          chartRef.current?.timeScale().fitContent();
          // Force redraw โดยการ scroll เล็กน้อยแล้วกลับมา
          const timeScale = chartRef.current?.timeScale();
          if (timeScale) {
            const currentRange = timeScale.getVisibleLogicalRange();
            if (currentRange) {
              timeScale.setVisibleLogicalRange({
                from: currentRange.from - 0.001,
                to: currentRange.to + 0.001,
              });
              setTimeout(() => {
                timeScale.fitContent();
              }, 10);
            }
          }
        }

        // Update fullscreen chart if active
        if (fullscreenSeriesRef.current) {
          fullscreenSeriesRef.current.applyOptions(chartOptions);
          fullscreenSeriesRef.current.setData(filteredData);

          // คำนวณ barSpacing สำหรับ fullscreen
          const fullscreenWidth =
            fullscreenChartContainerRef.current?.clientWidth ||
            window.innerWidth;
          let fullscreenBarSpacing = Math.floor(
            (fullscreenWidth - 40) / Math.max(dataLength, 1)
          );
          if (fullscreenBarSpacing > 150) fullscreenBarSpacing = 150;
          if (fullscreenBarSpacing < 3) fullscreenBarSpacing = 3;

          // ปรับ time scale สำหรับ fullscreen ด้วย
          fullscreenChartRef.current?.timeScale().applyOptions({
            barSpacing: fullscreenBarSpacing,
            rightOffset: 0,
          });
          fullscreenChartRef.current?.timeScale().fitContent();
        }
      }
    } catch (err) {
      console.error('Chart error:', err);
    } finally {
      setChartLoading(false);
    }
  }, [symbol, timeRange]);

  // สร้างกราฟ - รอให้ mounted ก่อน
  useEffect(() => {
    if (!mounted) return;

    const timer = setTimeout(() => {
      if (!chartContainerRef.current || chartRef.current) return;

      // Responsive chart height
      const isMobileView = window.innerWidth < 600;
      const chartHeight = isMobileView
        ? Math.max(280, window.innerHeight - 400) // Mobile: เพิ่ม height เพื่อให้มีที่ว่างสำหรับ time scale + labels
        : 400; // Desktop: fixed

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: isMobileView ? '#0a0a0a' : CHART_COLORS.card },
          textColor: CHART_COLORS.textSecondary,
          attributionLogo: false,
        },
        grid: {
          vertLines: {
            color: isMobileView
              ? 'rgba(255,255,255,0.05)'
              : CHART_COLORS.border,
          },
          horzLines: {
            color: isMobileView
              ? 'rgba(255,255,255,0.05)'
              : CHART_COLORS.border,
          },
        },
        width: chartContainerRef.current.clientWidth,
        height: chartHeight,
        crosshair: {
          mode: 0, // Magnet mode for both mobile and desktop
          vertLine: {
            visible: true,
            labelVisible: false, // Hide time label - use custom tooltip
            style: 3, // Dashed line
            width: 1,
            color: 'rgba(255, 255, 255, 0.3)',
            labelBackgroundColor: '#6366f1',
          },
          horzLine: {
            visible: false, // Hide horizontal line
            labelVisible: false, // Hide price label on right
            style: 3,
            width: 1,
            color: 'rgba(255, 255, 255, 0.3)',
            labelBackgroundColor: '#6366f1',
          },
        },
        handleScroll: false,
        handleScale: false,
        kineticScroll: {
          touch: false,
          mouse: false,
        },
        timeScale: {
          visible: true, // แสดง time scale ทั้ง desktop และ mobile
          borderColor: isMobileView
            ? 'rgba(255,255,255,0.15)'
            : CHART_COLORS.border,
          timeVisible: true,
          secondsVisible: false,
          tickMarkMaxCharacterLength: isMobileView ? 8 : 10,
          fixLeftEdge: true,
          fixRightEdge: true,
          ticksVisible: true,
          uniformDistribution: false, // ปิด uniform เพื่อให้แสดง label ได้ดีขึ้น
          minimumHeight: 28, // height สำหรับ time scale
          rightOffset: 5,
          barSpacing: isMobileView ? 2 : 6,
        },
        rightPriceScale: {
          visible: false, // Hide price scale on both mobile and desktop
          borderColor: 'transparent',
        },
        localization: {
          locale: 'en-US',
          timeFormatter: (timestamp: number) => {
            // ใช้ timeRangeRef เพื่อ format ตามช่วงเวลาที่เลือก
            const date = new Date(timestamp * 1000);
            const currentRange = timeRangeRef.current;
            const monthNames = [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ];

            if (currentRange === '1D') {
              // แสดงเวลา: 09:30, 10:00
              const hours = date.getUTCHours() + 7;
              const adjustedHours = hours >= 24 ? hours - 24 : hours;
              const minutes = date.getUTCMinutes();
              return `${adjustedHours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}`;
            } else if (
              currentRange === '1W' ||
              currentRange === '1M' ||
              currentRange === '3M'
            ) {
              // แสดงวันที่: Dec 9
              const day = date.getUTCDate();
              const month = monthNames[date.getUTCMonth()];
              return `${month} ${day}`;
            } else if (currentRange === '6M' || currentRange === '1Y') {
              // แสดงเดือน: Jul
              return monthNames[date.getUTCMonth()];
            } else {
              // 5Y, ALL - แสดงปี: 2023
              return date.getUTCFullYear().toString();
            }
          },
          dateFormat: 'dd MMM yyyy', // fallback format
        },
      });

      const series = chart.addSeries(AreaSeries, {
        topColor: `${CHART_COLORS.highlight}80`,
        bottomColor: `${CHART_COLORS.highlight}10`,
        lineColor: CHART_COLORS.highlight,
        lineWidth: 2,
        lastValueVisible: false, // Hide last value marker
        priceLineVisible: false, // Hide price line
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      // Handle touch events for mobile - show crosshair immediately on touch/move
      let touchHandlers: {
        start: (e: TouchEvent) => void;
        move: (e: TouchEvent) => void;
        end: (e: TouchEvent) => void;
      } | null = null;

      if (isMobileView && chartContainerRef.current) {
        const chartContainer = chartContainerRef.current;

        const findPriceAtTime = (
          targetTime: Time
        ): { price: number; index: number } | null => {
          const data = series.data();
          if (!data || data.length === 0) return null;

          // Convert target time to number for comparison
          let targetTimeNum: number;
          if (typeof targetTime === 'number') {
            targetTimeNum = targetTime;
          } else if (typeof targetTime === 'string') {
            targetTimeNum = new Date(targetTime).getTime() / 1000;
          } else {
            // BusinessDay type: { year, month, day }
            const bd = targetTime as {
              year: number;
              month: number;
              day: number;
            };
            targetTimeNum =
              new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
          }

          // Find closest data point
          let closestIndex = 0;
          let minDiff = Infinity;

          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let itemTimeNum: number;
            if (typeof item.time === 'number') {
              itemTimeNum = item.time;
            } else if (typeof item.time === 'string') {
              itemTimeNum = new Date(item.time).getTime() / 1000;
            } else {
              const bd = item.time as {
                year: number;
                month: number;
                day: number;
              };
              itemTimeNum =
                new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
            }

            const diff = Math.abs(itemTimeNum - targetTimeNum);
            if (diff < minDiff) {
              minDiff = diff;
              closestIndex = i;
            }
          }

          const closestItem = data[closestIndex];
          if (closestItem && 'value' in closestItem) {
            return {
              price: (closestItem as { value: number }).value,
              index: closestIndex,
            };
          }
          return null;
        };

        const updateCrosshair = (touchX: number, touchY: number) => {
          const bcr = chartContainer.getBoundingClientRect();
          const x = touchX - bcr.left;
          const y = touchY - bcr.top;

          // Convert pixel coordinates to time
          const time = chart.timeScale().coordinateToTime(x);

          if (time !== null) {
            // Get any price to set crosshair (it will snap to actual data point in magnet mode)
            const price = series.coordinateToPrice(y);
            if (price !== null) {
              chart.setCrosshairPosition(price, time, series);
            }

            // Find actual price at this time from series data
            const result = findPriceAtTime(time);
            if (result) {
              const priceY = series.priceToCoordinate(result.price);
              if (priceY !== null) {
                setTouchPrice(result.price);
                setTouchPosition({
                  x: x,
                  y: priceY,
                  chartWidth: bcr.width,
                  chartHeight: bcr.height,
                });

                // Format time for display
                const monthNames = [
                  'ม.ค.',
                  'ก.พ.',
                  'มี.ค.',
                  'เม.ย.',
                  'พ.ค.',
                  'มิ.ย.',
                  'ก.ค.',
                  'ส.ค.',
                  'ก.ย.',
                  'ต.ค.',
                  'พ.ย.',
                  'ธ.ค.',
                ];

                let timeStr = '';
                if (typeof time === 'number') {
                  // Unix timestamp - data ถูก +7 ชม. ไว้แล้วตอน parse
                  // ดังนั้นใช้ UTC time ตรงๆ ได้เลย (เพราะเป็นเวลาไทยแล้ว)
                  const date = new Date(time * 1000);
                  const hours = date.getUTCHours();
                  const minutes = date.getUTCMinutes();
                  const day = date.getUTCDate();
                  const month = date.getUTCMonth();
                  timeStr = `${day} ${monthNames[month]} ${hours
                    .toString()
                    .padStart(2, '0')}:${minutes
                    .toString()
                    .padStart(2, '0')} น.`;
                } else if (typeof time === 'string') {
                  // Date string
                  const date = new Date(time);
                  const day = date.getDate();
                  const month = date.getMonth();
                  const year = date.getFullYear() + 543; // พ.ศ.
                  timeStr = `${day} ${monthNames[month]} ${year}`;
                } else {
                  // BusinessDay
                  const bd = time as {
                    year: number;
                    month: number;
                    day: number;
                  };
                  const year = bd.year + 543; // พ.ศ.
                  timeStr = `${bd.day} ${monthNames[bd.month - 1]} ${year}`;
                }
                setTouchTime(timeStr);
              }
            }
          }
        };

        const handleTouchStart = (e: TouchEvent) => {
          e.preventDefault();
          const touch = e.touches[0];
          updateCrosshair(touch.clientX, touch.clientY);
        };

        const handleTouchMove = (e: TouchEvent) => {
          e.preventDefault();
          const touch = e.touches[0];
          updateCrosshair(touch.clientX, touch.clientY);
        };

        const handleTouchEnd = (e: TouchEvent) => {
          e.preventDefault();
          // Clear crosshair and tooltip when touch ends
          chart.clearCrosshairPosition();
          setTouchPrice(null);
          setTouchTime(null);
          setTouchPosition(null);
        };

        touchHandlers = {
          start: handleTouchStart,
          move: handleTouchMove,
          end: handleTouchEnd,
        };

        chartContainer.addEventListener('touchstart', handleTouchStart, {
          passive: false,
        });
        chartContainer.addEventListener('touchmove', handleTouchMove, {
          passive: false,
        });
        chartContainer.addEventListener('touchend', handleTouchEnd, {
          passive: false,
        });
        chartContainer.addEventListener('touchcancel', handleTouchEnd, {
          passive: false,
        });
      }

      // Handle mouse events for desktop
      if (!isMobileView && chartContainerRef.current) {
        const chartContainer = chartContainerRef.current;

        const findPriceAtTimeDesktop = (
          targetTime: Time
        ): { price: number; index: number } | null => {
          const data = series.data();
          if (!data || data.length === 0) return null;

          let targetTimeNum: number;
          if (typeof targetTime === 'number') {
            targetTimeNum = targetTime;
          } else if (typeof targetTime === 'string') {
            targetTimeNum = new Date(targetTime).getTime() / 1000;
          } else {
            const bd = targetTime as {
              year: number;
              month: number;
              day: number;
            };
            targetTimeNum =
              new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
          }

          let closestIndex = 0;
          let minDiff = Infinity;

          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let itemTimeNum: number;
            if (typeof item.time === 'number') {
              itemTimeNum = item.time;
            } else if (typeof item.time === 'string') {
              itemTimeNum = new Date(item.time).getTime() / 1000;
            } else {
              const bd = item.time as {
                year: number;
                month: number;
                day: number;
              };
              itemTimeNum =
                new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
            }

            const diff = Math.abs(itemTimeNum - targetTimeNum);
            if (diff < minDiff) {
              minDiff = diff;
              closestIndex = i;
            }
          }

          const closestItem = data[closestIndex];
          if (closestItem && 'value' in closestItem) {
            return {
              price: (closestItem as { value: number }).value,
              index: closestIndex,
            };
          }
          return null;
        };

        const monthNames = [
          'ม.ค.',
          'ก.พ.',
          'มี.ค.',
          'เม.ย.',
          'พ.ค.',
          'มิ.ย.',
          'ก.ค.',
          'ส.ค.',
          'ก.ย.',
          'ต.ค.',
          'พ.ย.',
          'ธ.ค.',
        ];

        const handleMouseMove = (e: MouseEvent) => {
          const bcr = chartContainer.getBoundingClientRect();
          const x = e.clientX - bcr.left;
          const y = e.clientY - bcr.top;

          const time = chart.timeScale().coordinateToTime(x);

          if (time !== null) {
            const price = series.coordinateToPrice(y);
            if (price !== null) {
              chart.setCrosshairPosition(price, time, series);
            }

            const result = findPriceAtTimeDesktop(time);
            if (result) {
              const priceY = series.priceToCoordinate(result.price);
              if (priceY !== null) {
                setTouchPrice(result.price);
                setTouchPosition({
                  x: x,
                  y: priceY,
                  chartWidth: bcr.width,
                  chartHeight: bcr.height,
                });

                // Format time
                let timeStr = '';
                if (typeof time === 'number') {
                  const date = new Date(time * 1000);
                  const hours = date.getUTCHours();
                  const minutes = date.getUTCMinutes();
                  const day = date.getUTCDate();
                  const month = date.getUTCMonth();
                  timeStr = `${day} ${monthNames[month]} ${hours
                    .toString()
                    .padStart(2, '0')}:${minutes
                    .toString()
                    .padStart(2, '0')} น.`;
                } else if (typeof time === 'string') {
                  const date = new Date(time);
                  const day = date.getDate();
                  const month = date.getMonth();
                  const year = date.getFullYear() + 543;
                  timeStr = `${day} ${monthNames[month]} ${year}`;
                } else {
                  const bd = time as {
                    year: number;
                    month: number;
                    day: number;
                  };
                  const year = bd.year + 543;
                  timeStr = `${bd.day} ${monthNames[bd.month - 1]} ${year}`;
                }
                setTouchTime(timeStr);
              }
            }
          }
        };

        const handleMouseLeave = () => {
          chart.clearCrosshairPosition();
          setTouchPrice(null);
          setTouchTime(null);
          setTouchPosition(null);
        };

        chartContainer.addEventListener('mousemove', handleMouseMove);
        chartContainer.addEventListener('mouseleave', handleMouseLeave);
      }

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          const newIsMobile = window.innerWidth < 600;
          const newChartHeight = newIsMobile
            ? Math.max(280, window.innerHeight - 400)
            : 400;
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: newChartHeight,
            layout: {
              background: {
                color: newIsMobile ? '#0a0a0a' : CHART_COLORS.card,
              },
            },
            grid: {
              vertLines: {
                color: newIsMobile
                  ? 'rgba(255,255,255,0.05)'
                  : CHART_COLORS.border,
              },
              horzLines: {
                color: newIsMobile
                  ? 'rgba(255,255,255,0.05)'
                  : CHART_COLORS.border,
              },
            },
            rightPriceScale: {
              visible: false,
            },
            crosshair: {
              vertLine: {
                labelVisible: false,
              },
              horzLine: {
                visible: false,
                labelVisible: false,
              },
            },
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);

        // Cleanup touch event listeners
        if (touchHandlers && chartContainerRef.current) {
          const chartContainer = chartContainerRef.current;
          chartContainer.removeEventListener('touchstart', touchHandlers.start);
          chartContainer.removeEventListener('touchmove', touchHandlers.move);
          chartContainer.removeEventListener('touchend', touchHandlers.end);
          chartContainer.removeEventListener('touchcancel', touchHandlers.end);
        }
      };
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [mounted]);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // สร้าง Fullscreen Chart
  useEffect(() => {
    if (!isFullscreen || !fullscreenChartContainerRef.current) {
      // Cleanup fullscreen chart when closing
      if (fullscreenChartRef.current) {
        fullscreenChartRef.current.remove();
        fullscreenChartRef.current = null;
        fullscreenSeriesRef.current = null;
        setFullscreenChartReady(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!fullscreenChartContainerRef.current || fullscreenChartRef.current)
        return;

      const chartHeight = window.innerHeight - 120; // Full height minus header/controls

      const chart = createChart(fullscreenChartContainerRef.current, {
        layout: {
          background: { color: '#0a0a0a' },
          textColor: CHART_COLORS.textSecondary,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.08)' },
          horzLines: { color: 'rgba(255,255,255,0.08)' },
        },
        width: fullscreenChartContainerRef.current.clientWidth,
        height: chartHeight,
        crosshair: {
          mode: 0,
          vertLine: {
            visible: true,
            labelVisible: true,
            style: 3,
            width: 1,
            color: 'rgba(255, 255, 255, 0.4)',
            labelBackgroundColor: '#6366f1',
          },
          horzLine: {
            visible: true,
            labelVisible: true,
            style: 3,
            width: 1,
            color: 'rgba(255, 255, 255, 0.4)',
            labelBackgroundColor: '#6366f1',
          },
        },
        handleScroll: true,
        handleScale: true,
        timeScale: {
          visible: true,
          borderColor: 'rgba(255,255,255,0.2)',
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          ticksVisible: true,
          minimumHeight: 36,
          rightOffset: 10,
          barSpacing: 8,
        },
        rightPriceScale: {
          visible: true,
          borderColor: 'rgba(255,255,255,0.2)',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        localization: {
          locale: 'en-US',
          timeFormatter: (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            const currentRange = timeRangeRef.current;
            const monthNames = [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ];

            if (currentRange === '1D') {
              const hours = date.getUTCHours() + 7;
              const adjustedHours = hours >= 24 ? hours - 24 : hours;
              const minutes = date.getUTCMinutes();
              return `${adjustedHours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}`;
            } else if (
              currentRange === '1W' ||
              currentRange === '1M' ||
              currentRange === '3M'
            ) {
              const day = date.getUTCDate();
              const month = monthNames[date.getUTCMonth()];
              return `${month} ${day}`;
            } else if (currentRange === '6M' || currentRange === '1Y') {
              return monthNames[date.getUTCMonth()];
            } else {
              return date.getUTCFullYear().toString();
            }
          },
          dateFormat: 'dd MMM yyyy',
        },
      });

      const series = chart.addSeries(AreaSeries, {
        topColor: `${CHART_COLORS.highlight}80`,
        bottomColor: `${CHART_COLORS.highlight}10`,
        lineColor: CHART_COLORS.highlight,
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
      });

      fullscreenChartRef.current = chart;
      fullscreenSeriesRef.current = series;
      setFullscreenChartReady(true);

      // Handle resize
      const handleResize = () => {
        if (fullscreenChartContainerRef.current && fullscreenChartRef.current) {
          const newHeight = window.innerHeight - 120;
          fullscreenChartRef.current.applyOptions({
            width: fullscreenChartContainerRef.current.clientWidth,
            height: newHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isFullscreen]);

  // โหลด fullscreen chart data เมื่อพร้อม
  useEffect(() => {
    if (fullscreenChartReady) {
      fetchChartData();
    }
  }, [fullscreenChartReady, fetchChartData]);

  // โหลดข้อมูลเมื่อเริ่ม
  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // โหลดกราฟเมื่อ chart พร้อมหรือเปลี่ยน timeRange
  useEffect(() => {
    if (chartReady) {
      fetchChartData();
    }
  }, [chartReady, timeRange, fetchChartData]);

  // จัดการ watchlist
  const toggleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(symbol);
      setInWatchlist(false);
    } else {
      addToWatchlist(symbol, stockName);
      setInWatchlist(true);
    }
  };

  const isPositive = stockData ? stockData.change >= 0 : true;
  const timeRanges: TimeRange[] = [
    '1D',
    '1W',
    '1M',
    '3M',
    '6M',
    '1Y',
    '5Y',
    'ALL',
  ];

  // Mobile Layout (Robinhood style)
  const mobileContent = (
    <Box
      sx={{
        minHeight: '100dvh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mobile Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <IconButton onClick={() => router.push('/')} sx={{ color: 'white' }}>
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={toggleWatchlist}
            sx={{ color: inWatchlist ? '#e94560' : 'rgba(255,255,255,0.7)' }}
          >
            {inWatchlist ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>
          <IconButton
            onClick={() => {
              fetchStockData();
              fetchChartData();
            }}
            disabled={loading || chartLoading}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <RefreshIcon
              sx={{
                animation:
                  loading || chartLoading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          </IconButton>
        </Box>
      </Box>

      {/* Stock Info */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StockLogo
              symbol={symbol}
              name={stockName}
              size={{ xs: 40, sm: 48 }}
            />
            <Box>
              <Typography
                sx={{
                  color: '#6366f1',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                }}
              >
                {symbol}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.875rem',
                  mt: 0.5,
                }}
              >
                {stockName}
              </Typography>
            </Box>
          </Box>

          {/* Badges - Market & Exchange */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              alignItems: 'flex-end',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
                px: 1,
                py: 0.25,
              }}
            >
              <Box component="span" sx={{ fontSize: '0.7rem' }}>
                {marketInfo.flag}
              </Box>
              <Typography
                sx={{
                  color: '#a5b4fc',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                }}
              >
                {marketInfo.country}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                backgroundColor: `${marketInfo.color}20`,
                border: `1px solid ${marketInfo.color}40`,
                borderRadius: '12px',
                px: 1,
                py: 0.25,
              }}
            >
              <Box component="span" sx={{ fontSize: '0.7rem' }}>
                {marketInfo.flag}
              </Box>
              <Typography
                sx={{
                  color: marketInfo.color,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                }}
              >
                {marketInfo.exchange}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Price */}
        {loading ? (
          <Box>
            <Skeleton
              variant="text"
              width="50%"
              height={50}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
            <Skeleton
              variant="text"
              width="30%"
              height={30}
              sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
            />
          </Box>
        ) : stockData ? (
          <Box>
            <Typography
              sx={{
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              ${formatNumber(stockData.price)}
            </Typography>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
            >
              {periodIsPositive ? (
                <Box
                  component="span"
                  sx={{
                    color: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ↗
                </Box>
              ) : (
                <Box
                  component="span"
                  sx={{
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ↘
                </Box>
              )}
              <Typography
                sx={{
                  color: periodIsPositive ? '#22c55e' : '#ef4444',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                }}
              >
                {periodIsPositive ? '+' : ''}
                {formatNumber(periodChangePercent)}%
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.875rem',
                }}
              >
                {timeRange === '1D'
                  ? 'วันนี้'
                  : timeRange === '1W'
                  ? '1 สัปดาห์'
                  : timeRange === '1M'
                  ? 'เดือนนี้'
                  : timeRange === '3M'
                  ? '3 เดือน'
                  : timeRange === '6M'
                  ? '6 เดือน'
                  : timeRange === '1Y'
                  ? 'ปีนี้'
                  : timeRange === '5Y'
                  ? '5 ปี'
                  : 'ทั้งหมด'}
              </Typography>
            </Box>
          </Box>
        ) : null}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{
            mx: 2,
            mt: 2,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 2,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Chart - Full Width */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          mt: 2,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 280, // เพิ่ม height เพื่อให้มีพื้นที่สำหรับ time scale + labels
          }}
        >
          <Box
            ref={chartContainerRef}
            sx={{
              width: '100%',
              height: '100%',
              minHeight: 280,
              pb: 1, // padding bottom สำหรับ time scale
            }}
          />

          {/* Fullscreen Button - Mobile */}
          <IconButton
            onClick={() => setIsFullscreen(true)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'rgba(255,255,255,0.6)',
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              '&:hover': {
                backgroundColor: 'rgba(99, 102, 241, 0.3)',
                color: 'white',
              },
              zIndex: 5,
            }}
          >
            <FullscreenIcon />
          </IconButton>

          {chartLoading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              }}
            >
              <CircularProgress sx={{ color: '#22c55e' }} />
            </Box>
          )}

          {/* Price Tooltip - แสดงเมื่อ touch */}
          {touchPrice !== null &&
            touchPosition !== null &&
            (() => {
              // คำนวณตำแหน่ง tooltip ให้ไม่ออกนอกขอบ
              const tooltipWidth = 90; // ความกว้างโดยประมาณของ tooltip
              const padding = 8; // ระยะห่างจากขอบ
              const chartWidth = touchPosition.chartWidth;

              let tooltipX = touchPosition.x;
              let translateX = '-50%'; // ค่าเริ่มต้น: อยู่ตรงกลาง

              // ถ้าติดขอบซ้าย
              if (touchPosition.x < tooltipWidth / 2 + padding) {
                tooltipX = padding;
                translateX = '0%';
              }
              // ถ้าติดขอบขวา
              else if (
                touchPosition.x >
                chartWidth - tooltipWidth / 2 - padding
              ) {
                tooltipX = chartWidth - padding;
                translateX = '-100%';
              }

              return (
                <Box
                  sx={{
                    position: 'absolute',
                    left: tooltipX,
                    top: touchPosition.y,
                    transform: `translate(${translateX}, -100%)`,
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%)',
                    color: 'white',
                    px: 1,
                    py: 0.4,
                    borderRadius: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    boxShadow:
                      '0 4px 20px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                    marginTop: '-12px',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    letterSpacing: '0.5px',
                  }}
                >
                  ${formatNumber(touchPrice)}
                </Box>
              );
            })()}

          {/* Time Tooltip - แสดงเวลาเมื่อ touch */}
          {touchTime !== null &&
            touchPosition !== null &&
            (() => {
              // คำนวณตำแหน่ง tooltip ให้ไม่ออกนอกขอบ
              const tooltipWidth = 120; // ความกว้างโดยประมาณของ time tooltip
              const padding = 8;
              const chartWidth = touchPosition.chartWidth;
              const chartHeight = touchPosition.chartHeight;

              let tooltipX = touchPosition.x;
              let translateX = '-50%';

              // ถ้าติดขอบซ้าย
              if (touchPosition.x < tooltipWidth / 2 + padding) {
                tooltipX = padding;
                translateX = '0%';
              }
              // ถ้าติดขอบขวา
              else if (
                touchPosition.x >
                chartWidth - tooltipWidth / 2 - padding
              ) {
                tooltipX = chartWidth - padding;
                translateX = '-100%';
              }

              return (
                <Box
                  sx={{
                    position: 'absolute',
                    left: tooltipX,
                    top: chartHeight - 25,
                    transform: `translateX(${translateX})`,
                    background:
                      'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(107, 101, 233, 0.95) 100%)',
                    color: 'white',
                    px: 1,
                    py: 0.3,
                    borderRadius: '5px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {touchTime}
                </Box>
              );
            })()}
        </Box>

        {/* Time Range Buttons */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            py: 2,
            px: 2,
          }}
        >
          {timeRanges.map((range) => (
            <Button
              key={range}
              onClick={() => setTimeRange(range)}
              sx={{
                minWidth: 44,
                height: 36,
                borderRadius: '18px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: timeRange === range ? 'white' : 'rgba(255,255,255,0.5)',
                backgroundColor:
                  timeRange === range ? '#6366f1' : 'transparent',
                border: 'none',
                '&:hover': {
                  backgroundColor:
                    timeRange === range ? '#6366f1' : 'rgba(255,255,255,0.1)',
                },
              }}
            >
              {range}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Stats Grid */}
      {stockData && (
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}
            >
              เปิด
            </Typography>
            <Typography
              sx={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}
            >
              ${formatNumber(stockData.open)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}
            >
              สูงสุด
            </Typography>
            <Typography
              sx={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 500 }}
            >
              ${formatNumber(stockData.high)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}
            >
              ปริมาณ
            </Typography>
            <Typography
              sx={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}
            >
              {formatLargeNumber(stockData.volume)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}
            >
              ต่ำสุด
            </Typography>
            <Typography
              sx={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}
            >
              ${formatNumber(stockData.low)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Last Update Time - Mobile */}
      {lastUpdate && (
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <AccessTimeIcon
            sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}
          />
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.7rem',
            }}
          >
            อัพเดตล่าสุด: {formatDateTime(lastUpdate)}
          </Typography>
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ textAlign: 'center', pb: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
          ข้อมูลจาก {apiSource} • Stock Dashboard © 2025
        </Typography>
      </Box>
    </Box>
  );

  // Desktop Layout (original)
  const desktopContent = (
    <Box
      sx={{
        minHeight: '100dvh',
        background:
          'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        py: { xs: 1.5, sm: 4 },
        px: { xs: 1.5, sm: 3 },
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 3 } }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            mb: { xs: 2, sm: 3 },
          }}
        >
          <Tooltip title="กลับ">
            <IconButton
              onClick={() => router.push('/')}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>

          <StockLogo
            symbol={symbol}
            name={stockName}
            size={{ xs: 48, sm: 56 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                variant="h4"
                fontWeight={700}
                sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
              >
                {symbol}
              </Typography>
              <Tooltip
                title={inWatchlist ? 'ลบออกจากรายการ' : 'เพิ่มเข้ารายการ'}
              >
                <IconButton
                  onClick={toggleWatchlist}
                  sx={{ color: '#e94560', p: { xs: 0.5, sm: 1 } }}
                >
                  {inWatchlist ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.875rem', sm: '1rem' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {stockName}
            </Typography>
          </Box>

          {/* Badges - Market & Exchange (Desktop) */}
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderRadius: '16px',
                px: 1.5,
                py: 0.5,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <Box component="span" sx={{ fontSize: '0.85rem' }}>
                {marketInfo.flag}
              </Box>
              <Typography
                sx={{ color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 500 }}
              >
                {marketInfo.country}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                backgroundColor: `${marketInfo.color}15`,
                borderRadius: '16px',
                px: 1.5,
                py: 0.5,
                border: `1px solid ${marketInfo.color}40`,
              }}
            >
              <Box component="span" sx={{ fontSize: '0.85rem' }}>
                {marketInfo.flag}
              </Box>
              <Typography
                sx={{
                  color: marketInfo.color,
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}
              >
                {marketInfo.exchange}
              </Typography>
            </Box>
          </Box>

          <Tooltip title="รีเฟรช">
            <span>
              <IconButton
                onClick={() => {
                  fetchStockData();
                  fetchChartData();
                }}
                disabled={loading || chartLoading}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: '#e94560' },
                }}
              >
                <RefreshIcon
                  sx={{
                    animation:
                      loading || chartLoading
                        ? 'spin 1s linear infinite'
                        : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{
              mb: { xs: 2, sm: 3 },
              backgroundColor: 'rgba(255, 23, 68, 0.1)',
              border: '1px solid rgba(255, 23, 68, 0.5)',
              borderRadius: 2,
            }}
          >
            {error}
          </Alert>
        )}

        {/* Main Content */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' },
            gap: { xs: 2, sm: 3 },
          }}
        >
          {/* Price Card */}
          <Paper
            elevation={8}
            sx={{
              p: { xs: 2, sm: 3 },
              backgroundColor: 'rgba(26, 26, 46, 0.95)',
              borderRadius: { xs: 2, sm: 3 },
              border: '1px solid rgba(233, 69, 96, 0.2)',
            }}
          >
            {loading ? (
              <Box>
                <Skeleton variant="text" width="60%" height={60} />
                <Skeleton variant="text" width="40%" height={40} />
                <Divider sx={{ my: 2, borderColor: 'rgba(45, 45, 68, 0.5)' }} />
                {[...Array(5)].map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1.5,
                    }}
                  >
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="30%" />
                  </Box>
                ))}
              </Box>
            ) : stockData ? (
              <Box>
                <Typography
                  variant="h3"
                  fontWeight={700}
                  gutterBottom
                  sx={{ fontSize: { xs: '2rem', sm: '3rem' } }}
                >
                  ${formatNumber(stockData.price)}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: { xs: 2, sm: 3 },
                  }}
                >
                  {periodIsPositive ? (
                    <TrendingUpIcon
                      sx={{
                        color: '#22c55e',
                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                      }}
                    />
                  ) : (
                    <TrendingDownIcon
                      sx={{
                        color: '#ef4444',
                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                      }}
                    />
                  )}
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{
                      color: periodIsPositive ? '#22c55e' : '#ef4444',
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                    }}
                  >
                    {periodIsPositive ? '+' : ''}
                    {formatNumber(periodChange)} ({periodIsPositive ? '+' : ''}
                    {formatNumber(periodChangePercent)}%)
                    <Typography
                      component="span"
                      sx={{
                        ml: 1,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                      }}
                    >
                      {timeRange === '1D'
                        ? 'วันนี้'
                        : timeRange === '1W'
                        ? '1 สัปดาห์'
                        : timeRange === '1M'
                        ? 'เดือนนี้'
                        : timeRange === '3M'
                        ? '3 เดือน'
                        : timeRange === '6M'
                        ? '6 เดือน'
                        : timeRange === '1Y'
                        ? 'ปีนี้'
                        : timeRange === '5Y'
                        ? '5 ปี'
                        : 'ทั้งหมด'}
                    </Typography>
                  </Typography>
                </Box>

                <Divider
                  sx={{
                    my: { xs: 1.5, sm: 2 },
                    borderColor: 'rgba(45, 45, 68, 0.5)',
                  }}
                />

                {/* Stats */}
                <Box
                  sx={{
                    '& > div': {
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: { xs: 1, sm: 1.5 },
                    },
                  }}
                >
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      เปิด
                    </Typography>
                    <Typography
                      fontWeight={500}
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      ${formatNumber(stockData.open)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      สูงสุด
                    </Typography>
                    <Typography
                      fontWeight={500}
                      sx={{
                        color: '#22c55e',
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                      }}
                    >
                      ${formatNumber(stockData.high)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      ต่ำสุด
                    </Typography>
                    <Typography
                      fontWeight={500}
                      sx={{
                        color: '#ef4444',
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                      }}
                    >
                      ${formatNumber(stockData.low)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      ปิดวันก่อน
                    </Typography>
                    <Typography
                      fontWeight={500}
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      ${formatNumber(stockData.previousClose)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      ปริมาณ
                    </Typography>
                    <Typography
                      fontWeight={500}
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {formatLargeNumber(stockData.volume)}
                    </Typography>
                  </Box>
                </Box>

                {/* Last Update */}
                {lastUpdate && (
                  <Box
                    sx={{
                      mt: { xs: 2, sm: 3 },
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <AccessTimeIcon
                      sx={{ fontSize: 16, color: 'text.secondary' }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                    >
                      อัพเดตล่าสุด: {formatDateTime(lastUpdate)}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : null}
          </Paper>

          {/* Chart */}
          <Paper
            elevation={8}
            sx={{
              p: { xs: 1.5, sm: 3 },
              backgroundColor: 'rgba(26, 26, 46, 0.95)',
              borderRadius: { xs: 2, sm: 3 },
              border: '1px solid rgba(233, 69, 96, 0.2)',
            }}
          >
            {/* Time Range Selector */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: { xs: 1.5, sm: 0 },
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                >
                  กราฟราคา
                </Typography>
                <Tooltip title="ดูเต็มจอ">
                  <IconButton
                    onClick={() => setIsFullscreen(true)}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: '#6366f1' },
                    }}
                  >
                    <FullscreenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <ButtonGroup
                size="small"
                variant="outlined"
                sx={{
                  '& .MuiButton-root': {
                    minWidth: { xs: 40, sm: 48 },
                    px: { xs: 1, sm: 1.5 },
                    fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                  },
                }}
              >
                {timeRanges.map((range) => (
                  <Button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    sx={{
                      color: timeRange === range ? 'white' : 'text.secondary',
                      backgroundColor:
                        timeRange === range ? '#e94560' : 'transparent',
                      borderColor: 'rgba(45, 45, 68, 0.8)',
                      '&:hover': {
                        backgroundColor:
                          timeRange === range
                            ? '#e94560'
                            : 'rgba(15, 52, 96, 0.5)',
                        borderColor: 'rgba(233, 69, 96, 0.5)',
                      },
                    }}
                  >
                    {range}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>

            {/* Chart Container */}
            <Box sx={{ position: 'relative', minHeight: { xs: 280, sm: 400 } }}>
              <Box
                ref={chartContainerRef}
                sx={{ width: '100%', height: { xs: 280, sm: 400 } }}
              />
              {chartLoading && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: 2,
                  }}
                >
                  <CircularProgress sx={{ color: '#e94560' }} />
                </Box>
              )}

              {/* Price Tooltip - Desktop */}
              {touchPrice !== null &&
                touchPosition !== null &&
                (() => {
                  const tooltipWidth = 90;
                  const padding = 8;
                  const chartWidth = touchPosition.chartWidth;

                  let tooltipX = touchPosition.x;
                  let translateX = '-50%';

                  if (touchPosition.x < tooltipWidth / 2 + padding) {
                    tooltipX = padding;
                    translateX = '0%';
                  } else if (
                    touchPosition.x >
                    chartWidth - tooltipWidth / 2 - padding
                  ) {
                    tooltipX = chartWidth - padding;
                    translateX = '-100%';
                  }

                  return (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: tooltipX,
                        top: touchPosition.y,
                        transform: `translate(${translateX}, -100%)`,
                        background:
                          'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%)',
                        color: 'black',
                        px: 1,
                        py: 0.4,
                        borderRadius: '5px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        boxShadow:
                          '0 4px 20px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        whiteSpace: 'nowrap',
                        marginTop: '-12px',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      ${formatNumber(touchPrice)}
                    </Box>
                  );
                })()}

              {/* Time Tooltip - Desktop */}
              {touchTime !== null &&
                touchPosition !== null &&
                (() => {
                  const tooltipWidth = 120;
                  const padding = 8;
                  const chartWidth = touchPosition.chartWidth;
                  const chartHeight = touchPosition.chartHeight;

                  let tooltipX = touchPosition.x;
                  let translateX = '-50%';

                  if (touchPosition.x < tooltipWidth / 2 + padding) {
                    tooltipX = padding;
                    translateX = '0%';
                  } else if (
                    touchPosition.x >
                    chartWidth - tooltipWidth / 2 - padding
                  ) {
                    tooltipX = chartWidth - padding;
                    translateX = '-100%';
                  }

                  return (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: tooltipX,
                        top: chartHeight - 25,
                        transform: `translateX(${translateX})`,
                        background:
                          'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(107, 101, 233, 0.95) 100%)',
                        color: 'white',
                        px: 1,
                        py: 0.3,
                        borderRadius: '5px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        whiteSpace: 'nowrap',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      {touchTime}
                    </Box>
                  );
                })()}
            </Box>
          </Paper>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            mt: { xs: 2, sm: 4 },
            textAlign: 'center',
            pb: { xs: 2, sm: 0 },
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
          >
            ข้อมูลจาก {apiSource} • Stock Dashboard © 2025
          </Typography>
        </Box>
      </Container>
    </Box>
  );

  // Fullscreen Chart Modal
  const fullscreenChart = (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0a0a',
        display: isFullscreen ? 'flex' : 'none',
        flexDirection: 'column',
      }}
    >
      {/* Fullscreen Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <StockLogo
            symbol={symbol}
            name={stockName}
            size={{ xs: 36, sm: 40 }}
          />
          <Box>
            <Typography
              sx={{ color: '#6366f1', fontWeight: 700, fontSize: '1.25rem' }}
            >
              {symbol}
            </Typography>
            <Typography
              sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}
            >
              {stockName}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Price Display in Fullscreen */}
          {stockData && (
            <Box sx={{ textAlign: 'right', mr: 2 }}>
              <Typography
                sx={{ color: 'white', fontWeight: 700, fontSize: '1.5rem' }}
              >
                ${formatNumber(stockData.price)}
              </Typography>
              <Typography
                sx={{
                  color: periodIsPositive ? '#22c55e' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {periodIsPositive ? '+' : ''}
                {formatNumber(periodChangePercent)}%
              </Typography>
            </Box>
          )}
          <IconButton
            onClick={() => setIsFullscreen(false)}
            sx={{
              color: 'white',
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Time Range Buttons - Fullscreen */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 1,
          py: 1.5,
          px: 2,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {timeRanges.map((range) => (
          <Button
            key={range}
            onClick={() => setTimeRange(range)}
            sx={{
              minWidth: 50,
              height: 32,
              borderRadius: '16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: timeRange === range ? 'white' : 'rgba(255,255,255,0.5)',
              backgroundColor: timeRange === range ? '#6366f1' : 'transparent',
              border: 'none',
              '&:hover': {
                backgroundColor:
                  timeRange === range ? '#6366f1' : 'rgba(255,255,255,0.1)',
              },
            }}
          >
            {range}
          </Button>
        ))}
      </Box>

      {/* Fullscreen Chart Container */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Box
          ref={fullscreenChartContainerRef}
          sx={{
            width: '100%',
            height: '100%',
          }}
        />
        {chartLoading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <CircularProgress sx={{ color: '#6366f1' }} />
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <ThemeRegistry>
      {isMobile ? mobileContent : desktopContent}
      {fullscreenChart}
    </ThemeRegistry>
  );
}
