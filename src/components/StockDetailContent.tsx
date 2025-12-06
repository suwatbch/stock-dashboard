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
} from '@mui/icons-material';
import { useWatchlist } from '@/hooks/useWatchlist';
import { StockQuote, TimeRange } from '@/types/stock';
import ThemeRegistry from './ThemeRegistry';

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
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

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

      const response = await fetch(`/api/stock?symbol=${symbol}&type=quote`);
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

      let type = 'daily';
      if (timeRange === '1D') type = 'intraday';
      else if (timeRange === '1W' || timeRange === '1M') type = 'daily';
      else if (timeRange === '3M' || timeRange === '1Y') type = 'weekly';
      else if (timeRange === 'ALL') type = 'monthly';

      const response = await fetch(`/api/stock?symbol=${symbol}&type=${type}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Parse data based on type
      let timeSeries: Record<string, Record<string, string>>;
      if (type === 'intraday') {
        timeSeries = data['Time Series (5min)'];
      } else if (type === 'daily') {
        timeSeries = data['Time Series (Daily)'];
      } else if (type === 'weekly') {
        timeSeries = data['Weekly Time Series'];
      } else {
        timeSeries = data['Monthly Time Series'];
      }

      if (!timeSeries || Object.keys(timeSeries).length === 0) {
        // ถ้าไม่มีข้อมูล intraday ให้ลองใช้ daily แทน
        if (type === 'intraday') {
          const dailyResponse = await fetch(
            `/api/stock?symbol=${symbol}&type=daily`
          );
          const dailyData = await dailyResponse.json();
          timeSeries = dailyData['Time Series (Daily)'];
          if (!timeSeries || Object.keys(timeSeries).length === 0) {
            // ไม่มีข้อมูลเลย - แสดงกราฟเปล่า
            console.warn('ไม่มีข้อมูลกราฟสำหรับ', symbol);
            setChartLoading(false);
            return;
          }
        } else {
          // ไม่มีข้อมูลเลย - แสดงกราฟเปล่า
          console.warn('ไม่มีข้อมูลกราฟสำหรับ', symbol);
          setChartLoading(false);
          return;
        }
      }

      // Convert to chart data
      // lightweight-charts displays timestamps as UTC, so we need to add local timezone offset
      // to make it display as Thai time (UTC+7)
      const chartData: AreaData<Time>[] = Object.entries(timeSeries)
        .map(([date, values]) => {
          let timeValue: Time;
          if (type === 'intraday') {
            // Parse date and add Thai timezone offset (7 hours) for chart display
            const parsedDate = new Date(date.replace(' ', 'T') + 'Z');
            const thaiOffset = 7 * 60 * 60; // 7 hours in seconds
            const timestamp =
              Math.floor(parsedDate.getTime() / 1000) + thaiOffset;
            timeValue = timestamp as Time;
          } else {
            timeValue = date as Time;
          }
          return {
            time: timeValue,
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
      let filteredData = chartData;
      if (timeRange === '1D') {
        filteredData = chartData.slice(-78);
      } else if (timeRange === '1W') {
        filteredData = chartData.slice(-7);
      } else if (timeRange === '1M') {
        filteredData = chartData.slice(-30);
      } else if (timeRange === '3M') {
        filteredData = chartData.slice(-13);
      } else if (timeRange === '1Y') {
        filteredData = chartData.slice(-52);
      }

      // Update chart
      if (seriesRef.current && filteredData.length > 0) {
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

        // เปลี่ยนสีตามทิศทาง (เขียวถ้าขึ้น, แดงถ้าลง)
        seriesRef.current.applyOptions({
          lineColor: isUptrend ? CHART_COLORS.success : CHART_COLORS.danger,
          topColor: isUptrend
            ? 'rgba(34, 197, 94, 0.4)'
            : 'rgba(239, 68, 68, 0.4)',
          bottomColor: isUptrend
            ? 'rgba(34, 197, 94, 0.05)'
            : 'rgba(239, 68, 68, 0.05)',
        });

        seriesRef.current.setData(filteredData);
        chartRef.current?.timeScale().fitContent();
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
        ? Math.max(300, window.innerHeight - 350) // Mobile: flexible height
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
          mode: 1, // Normal mode - follows mouse/touch
          vertLine: {
            labelVisible: true,
            style: 3, // Dashed line
            width: 1,
            color: 'rgba(255, 255, 255, 0.3)',
            labelBackgroundColor: '#6366f1',
          },
          horzLine: {
            labelVisible: true,
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
          borderColor: isMobileView ? 'transparent' : CHART_COLORS.border,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: isMobileView ? 'transparent' : CHART_COLORS.border,
        },
        localization: {
          locale: 'th-TH',
          timeFormatter: (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString('th-TH', {
              timeZone: 'Asia/Bangkok',
              hour: '2-digit',
              minute: '2-digit',
            });
          },
        },
      });

      const series = chart.addSeries(AreaSeries, {
        topColor: `${CHART_COLORS.highlight}80`,
        bottomColor: `${CHART_COLORS.highlight}10`,
        lineColor: CHART_COLORS.highlight,
        lineWidth: 2,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          const newIsMobile = window.innerWidth < 600;
          const newChartHeight = newIsMobile
            ? Math.max(300, window.innerHeight - 350)
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
  const timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

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
          <Box>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem',
                mb: 0.5,
              }}
            >
              {stockName}
            </Typography>
            <Typography
              sx={{
                color: '#6366f1',
                fontSize: '1.5rem',
                fontWeight: 700,
                mb: 1,
              }}
            >
              {symbol}
            </Typography>
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
                  ? 'สัปดาห์นี้'
                  : timeRange === '1M'
                  ? 'เดือนนี้'
                  : timeRange === '3M'
                  ? '3 เดือน'
                  : timeRange === '1Y'
                  ? 'ปีนี้'
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
            minHeight: 300,
          }}
        >
          <Box
            ref={chartContainerRef}
            sx={{
              width: '100%',
              height: '100%',
              minHeight: 300,
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
              <CircularProgress sx={{ color: '#22c55e' }} />
            </Box>
          )}
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
                        ? 'สัปดาห์นี้'
                        : timeRange === '1M'
                        ? 'เดือนนี้'
                        : timeRange === '3M'
                        ? '3 เดือน'
                        : timeRange === '1Y'
                        ? 'ปีนี้'
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
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                กราฟราคา
              </Typography>
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

  return (
    <ThemeRegistry>{isMobile ? mobileContent : desktopContent}</ThemeRegistry>
  );
}
