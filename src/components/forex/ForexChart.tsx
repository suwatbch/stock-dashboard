'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  CandlestickData,
  AreaSeries,
  AreaData,
} from 'lightweight-charts';
import {
  Box,
  CircularProgress,
  Typography,
  ButtonGroup,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CandlestickChart as CandlestickChartIcon,
  ShowChart as LineChartIcon,
} from '@mui/icons-material';
import { ForexTimeRange, FOREX_COLORS } from '@/types/forex';

type ChartType = 'candlestick' | 'line';

interface ForexChartProps {
  symbol: string;
  height?: number;
  onPriceUpdate?: (price: number, change: number) => void;
}

export default function ForexChart({
  symbol,
  height = 500,
  onPriceUpdate,
}: ForexChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<
    ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<ForexTimeRange>('5m');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [nextUpdate, setNextUpdate] = useState<number>(60);
  const [barSpacing, setBarSpacing] = useState<number>(10);
  const [chartType, setChartType] = useState<ChartType>('candlestick');

  const ZOOM_STORAGE_KEY = 'forex_chart_zoom';
  const CHART_TYPE_STORAGE_KEY = 'forex_chart_type';

  // โหลดค่า zoom และ chart type จาก localStorage
  useEffect(() => {
    const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (savedZoom) {
      const zoom = parseFloat(savedZoom);
      if (!isNaN(zoom) && zoom >= 2 && zoom <= 50) {
        setBarSpacing(zoom);
      }
    }

    const savedChartType = localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    if (savedChartType === 'line' || savedChartType === 'candlestick') {
      setChartType(savedChartType);
    }
  }, []);

  // ดึงข้อมูลกราฟ
  const fetchChartData = useCallback(
    async (showLoading = true) => {
      if (!symbol) return;

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/forex?action=timeseries&symbol=${encodeURIComponent(
            symbol
          )}&interval=${timeRange}&t=${Date.now()}`
        );

        if (!response.ok) throw new Error('Failed to fetch chart data');

        const result = await response.json();
        const data = result.data || [];

        if (seriesRef.current && data.length > 0) {
          if (chartType === 'candlestick') {
            // Candlestick data
            const chartData: CandlestickData<Time>[] = data.map(
              (d: {
                time: string;
                open: number;
                high: number;
                low: number;
                close: number;
              }) => ({
                time: (new Date(d.time).getTime() / 1000) as Time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
              })
            );
            (seriesRef.current as ISeriesApi<'Candlestick'>).setData(chartData);

            // อัพเดทราคาปัจจุบัน
            const lastCandle = chartData[chartData.length - 1];
            if (lastCandle && chartData.length > 1) {
              const prevCandle = chartData[chartData.length - 2];
              const change = lastCandle.close - prevCandle.close;
              onPriceUpdate?.(lastCandle.close, change);
            }
          } else {
            // Area data (ใช้ close price)
            const areaData: AreaData<Time>[] = data.map(
              (d: { time: string; close: number }) => ({
                time: (new Date(d.time).getTime() / 1000) as Time,
                value: d.close,
              })
            );

            // ตรวจสอบทิศทางราคา: จุดเริ่มต้น vs จุดสุดท้าย
            const firstPrice = areaData[0]?.value || 0;
            const lastPrice = areaData[areaData.length - 1]?.value || 0;
            const isUptrend = lastPrice >= firstPrice;

            // เปลี่ยนสีตามทิศทาง
            const areaSeries = seriesRef.current as ISeriesApi<'Area'>;
            areaSeries.applyOptions({
              lineColor: isUptrend ? FOREX_COLORS.success : '#F23645',
              topColor: isUptrend
                ? 'rgba(0, 200, 83, 0.4)'
                : 'rgba(242, 54, 69, 0.4)',
              bottomColor: isUptrend
                ? 'rgba(0, 200, 83, 0.05)'
                : 'rgba(242, 54, 69, 0.05)',
            });

            areaSeries.setData(areaData);

            // อัพเดทราคาปัจจุบัน
            if (areaData.length > 1) {
              const lastPoint = areaData[areaData.length - 1];
              const prevPoint = areaData[areaData.length - 2];
              const change = lastPoint.value - prevPoint.value;
              onPriceUpdate?.(lastPoint.value, change);
            }
          }

          // ใช้ค่า barSpacing ที่บันทึกไว้แทน fitContent
          if (chartRef.current) {
            const timeScale = chartRef.current.timeScale();
            timeScale.applyOptions({ barSpacing: barSpacing });
            timeScale.scrollToRealTime();
          }

          setLastUpdate(new Date());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [symbol, timeRange, barSpacing, chartType, onPriceUpdate]
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#0f0f1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#2a2e39',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#2a2e39',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.8)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.8)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 10,
      },
    });

    chartRef.current = chart;

    // สร้าง Series ตาม chartType
    if (chartType === 'candlestick') {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: FOREX_COLORS.success, // เขียว #00c853
        downColor: '#F23645', // แดงเข้ม
        borderVisible: false,
        wickUpColor: FOREX_COLORS.success, // ไส้เทียนเขียว
        wickDownColor: '#F23645', // ไส้เทียนแดง
      });
      seriesRef.current = candlestickSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: FOREX_COLORS.success, // เขียว (default)
        topColor: 'rgba(0, 200, 83, 0.4)', // เขียวโปร่งใส
        bottomColor: 'rgba(0, 200, 83, 0.05)', // เขียวจางมาก
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: true,
      });
      seriesRef.current = areaSeries;
    }

    // Resize handler
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
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [height, chartType]);

  // Fetch data when symbol or timeRange or chartType changes
  useEffect(() => {
    fetchChartData(true);
  }, [symbol, timeRange, chartType]);

  // Auto update ทุก 1 นาที (ตอน :00)
  useEffect(() => {
    // คำนวณเวลาที่เหลือจนถึง :00 ถัดไป
    const calculateSecondsUntilNextMinute = () => {
      const now = new Date();
      return 60 - now.getSeconds();
    };

    setNextUpdate(calculateSecondsUntilNextMinute());

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextUpdate((prev) => {
        if (prev <= 1) {
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    // รอจนถึง :00 ก่อน แล้วค่อย set interval ทุกนาที
    const secondsUntilNextMinute = calculateSecondsUntilNextMinute();

    let updateInterval: NodeJS.Timeout;

    const initialTimeout = setTimeout(() => {
      // Fetch ตอน :00
      fetchChartData(false);

      // หลังจากนั้น fetch ทุก 1 นาที
      updateInterval = setInterval(() => {
        fetchChartData(false);
      }, 60000);
    }, secondsUntilNextMinute * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(countdownInterval);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [symbol, timeRange, fetchChartData]);

  const timeRanges: {
    value: ForexTimeRange;
    label: string;
    tooltip: string;
  }[] = [
    { value: '1m', label: '1M', tooltip: '1 นาที/แท่ง (ย้อนหลัง 7 วัน)' },
    { value: '5m', label: '5M', tooltip: '5 นาที/แท่ง (ย้อนหลัง 60 วัน)' },
    { value: '15m', label: '15M', tooltip: '15 นาที/แท่ง (ย้อนหลัง 60 วัน)' },
    { value: '30m', label: '30M', tooltip: '30 นาที/แท่ง (ย้อนหลัง 60 วัน)' },
    { value: '1h', label: '1H', tooltip: '1 ชั่วโมง/แท่ง (ย้อนหลัง 2 ปี)' },
    { value: '1d', label: '1D', tooltip: '1 วัน/แท่ง (ย้อนหลัง 1 ปี)' },
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Toggle chart type
  const toggleChartType = () => {
    const newType = chartType === 'candlestick' ? 'line' : 'candlestick';
    setChartType(newType);
    localStorage.setItem(CHART_TYPE_STORAGE_KEY, newType);
  };

  // Zoom functions - แท่งเทียนสุดท้ายชิดขวาเสมอ + เก็บค่าใน localStorage
  // ค่าเริ่มต้น 10 = 100%, เพิ่ม/ลดครั้งละ 25% (2.5)
  const handleZoomIn = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const newBarSpacing = Math.min(barSpacing + 2.5, 50); // สูงสุด 500%
      setBarSpacing(newBarSpacing);
      localStorage.setItem(ZOOM_STORAGE_KEY, newBarSpacing.toString());
      timeScale.applyOptions({ barSpacing: newBarSpacing });
      // Scroll ไปขวาสุดเพื่อให้แท่งเทียนสุดท้ายชิดขวา
      timeScale.scrollToRealTime();
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const newBarSpacing = Math.max(barSpacing - 2.5, 2.5); // ต่ำสุด 25%
      setBarSpacing(newBarSpacing);
      localStorage.setItem(ZOOM_STORAGE_KEY, newBarSpacing.toString());
      timeScale.applyOptions({ barSpacing: newBarSpacing });
      // Scroll ไปขวาสุดเพื่อให้แท่งเทียนสุดท้ายชิดขวา
      timeScale.scrollToRealTime();
    }
  };

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {/* Time Range Buttons */}
        <ButtonGroup size="small" variant="outlined">
          {timeRanges.map((range) => (
            <Tooltip key={range.value} title={range.tooltip} arrow>
              <Button
                onClick={() => setTimeRange(range.value)}
                sx={{
                  color: timeRange === range.value ? '#26a69a' : '#758696',
                  borderColor: 'rgba(42, 46, 57, 0.8)',
                  bgcolor:
                    timeRange === range.value
                      ? 'rgba(38, 166, 154, 0.1)'
                      : 'transparent',
                  fontWeight: timeRange === range.value ? 700 : 400,
                  '&:hover': {
                    bgcolor: 'rgba(38, 166, 154, 0.2)',
                    borderColor: 'rgba(42, 46, 57, 0.8)',
                  },
                }}
              >
                {range.label}
              </Button>
            </Tooltip>
          ))}
        </ButtonGroup>

        {/* Update Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Zoom Buttons - ย่อซ้าย, ขยายขวา */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={`ย่อ (${Math.round((barSpacing / 10) * 100)}%)`}>
              <IconButton
                size="small"
                onClick={handleZoomOut}
                sx={{
                  color: '#758696',
                  bgcolor: 'rgba(42, 46, 57, 0.8)',
                  '&:hover': {
                    bgcolor: 'rgba(38, 166, 154, 0.2)',
                    color: '#26a69a',
                  },
                  width: 28,
                  height: 28,
                }}
              >
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={`ขยาย (${Math.round((barSpacing / 10) * 100)}%)`}>
              <IconButton
                size="small"
                onClick={handleZoomIn}
                sx={{
                  color: '#758696',
                  bgcolor: 'rgba(42, 46, 57, 0.8)',
                  '&:hover': {
                    bgcolor: 'rgba(38, 166, 154, 0.2)',
                    color: '#26a69a',
                  },
                  width: 28,
                  height: 28,
                }}
              >
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Chart Type Toggle */}
          <Tooltip
            title={
              chartType === 'candlestick'
                ? 'เปลี่ยนเป็นเส้น'
                : 'เปลี่ยนเป็นแท่งเทียน'
            }
          >
            <IconButton
              size="small"
              onClick={toggleChartType}
              sx={{
                color: '#26a69a',
                bgcolor: 'rgba(38, 166, 154, 0.15)',
                '&:hover': {
                  bgcolor: 'rgba(38, 166, 154, 0.3)',
                },
                width: 28,
                height: 28,
              }}
            >
              {chartType === 'candlestick' ? (
                <LineChartIcon sx={{ fontSize: 18 }} />
              ) : (
                <CandlestickChartIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>

          {lastUpdate && (
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={`อัพเดท: ${formatTime(lastUpdate)}`}
              size="small"
              sx={{
                bgcolor: 'rgba(42, 46, 57, 0.8)',
                color: '#758696',
                fontSize: '0.75rem',
              }}
            />
          )}
          <Chip
            label={`ถัดไป: ${nextUpdate}s`}
            size="small"
            sx={{
              bgcolor:
                nextUpdate <= 10
                  ? 'rgba(239, 83, 80, 0.2)'
                  : 'rgba(38, 166, 154, 0.2)',
              color: nextUpdate <= 10 ? '#ef5350' : '#26a69a',
              fontSize: '0.75rem',
              fontWeight: 600,
              minWidth: 80,
            }}
          />
        </Box>
      </Box>

      {/* Chart Container */}
      <Box
        ref={chartContainerRef}
        sx={{
          width: '100%',
          height: height,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#0f0f1a',
          border: '1px solid rgba(42, 46, 57, 0.8)',
        }}
      />

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress size={40} sx={{ color: '#26a69a' }} />
          <Typography sx={{ color: '#758696', fontSize: '0.875rem' }}>
            กำลังโหลดข้อมูล...
          </Typography>
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#ef5350', mb: 1 }}>{error}</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => fetchChartData(true)}
            sx={{ color: '#26a69a', borderColor: '#26a69a' }}
          >
            ลองใหม่
          </Button>
        </Box>
      )}
    </Box>
  );
}
