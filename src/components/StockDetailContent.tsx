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
  success: '#00c853',
  danger: '#ff1744',
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

  // Mount check
  useEffect(() => {
    setMounted(true);
  }, []);

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
        throw new Error('ไม่มีข้อมูลกราฟ');
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

        // เปลี่ยนสีตามทิศทาง (เขียวถ้าขึ้น, แดงถ้าลง)
        seriesRef.current.applyOptions({
          lineColor: isUptrend ? CHART_COLORS.success : CHART_COLORS.danger,
          topColor: isUptrend
            ? 'rgba(0, 200, 83, 0.4)'
            : 'rgba(255, 23, 68, 0.4)',
          bottomColor: isUptrend
            ? 'rgba(0, 200, 83, 0.05)'
            : 'rgba(255, 23, 68, 0.05)',
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

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: CHART_COLORS.card },
          textColor: CHART_COLORS.textSecondary,
        },
        grid: {
          vertLines: { color: CHART_COLORS.border },
          horzLines: { color: CHART_COLORS.border },
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
        crosshair: {
          mode: 1,
        },
        timeScale: {
          borderColor: CHART_COLORS.border,
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.border,
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
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
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

  const content = (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        py: { xs: 2, sm: 4 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
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

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" fontWeight={700}>
                {symbol}
              </Typography>
              <Tooltip
                title={inWatchlist ? 'ลบออกจากรายการ' : 'เพิ่มเข้ารายการ'}
              >
                <IconButton onClick={toggleWatchlist} sx={{ color: '#e94560' }}>
                  {inWatchlist ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body1" color="text.secondary">
              {stockName}
            </Typography>
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
              mb: 3,
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
            gap: 3,
          }}
        >
          {/* Price Card */}
          <Paper
            elevation={8}
            sx={{
              p: 3,
              backgroundColor: 'rgba(26, 26, 46, 0.95)',
              borderRadius: 3,
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
                <Typography variant="h3" fontWeight={700} gutterBottom>
                  ${formatNumber(stockData.price)}
                </Typography>

                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}
                >
                  {isPositive ? (
                    <TrendingUpIcon sx={{ color: '#00c853' }} />
                  ) : (
                    <TrendingDownIcon sx={{ color: '#ff1744' }} />
                  )}
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{ color: isPositive ? '#00c853' : '#ff1744' }}
                  >
                    {isPositive ? '+' : ''}
                    {formatNumber(stockData.change)} ({isPositive ? '+' : ''}
                    {formatNumber(stockData.changePercent)}%)
                  </Typography>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(45, 45, 68, 0.5)' }} />

                {/* Stats */}
                <Box
                  sx={{
                    '& > div': {
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 1.5,
                    },
                  }}
                >
                  <Box>
                    <Typography color="text.secondary">เปิด</Typography>
                    <Typography fontWeight={500}>
                      ${formatNumber(stockData.open)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary">สูงสุด</Typography>
                    <Typography fontWeight={500} sx={{ color: '#00c853' }}>
                      ${formatNumber(stockData.high)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary">ต่ำสุด</Typography>
                    <Typography fontWeight={500} sx={{ color: '#ff1744' }}>
                      ${formatNumber(stockData.low)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary">ปิดวันก่อน</Typography>
                    <Typography fontWeight={500}>
                      ${formatNumber(stockData.previousClose)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary">ปริมาณ</Typography>
                    <Typography fontWeight={500}>
                      {formatLargeNumber(stockData.volume)}
                    </Typography>
                  </Box>
                </Box>

                {/* Last Update */}
                {lastUpdate && (
                  <Box
                    sx={{
                      mt: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <AccessTimeIcon
                      sx={{ fontSize: 16, color: 'text.secondary' }}
                    />
                    <Typography variant="caption" color="text.secondary">
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
              p: 3,
              backgroundColor: 'rgba(26, 26, 46, 0.95)',
              borderRadius: 3,
              border: '1px solid rgba(233, 69, 96, 0.2)',
            }}
          >
            {/* Time Range Selector */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                กราฟราคา
              </Typography>
              <ButtonGroup size="small" variant="outlined">
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
            <Box sx={{ position: 'relative', minHeight: 400 }}>
              <Box
                ref={chartContainerRef}
                sx={{ width: '100%', height: 400 }}
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
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            ข้อมูลจาก {apiSource} • Stock Dashboard © 2025
          </Typography>
        </Box>
      </Container>
    </Box>
  );

  return <ThemeRegistry>{content}</ThemeRegistry>;
}
