'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Skeleton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ShowChart as ShowChartIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import { useWatchlist } from '@/hooks/useWatchlist';
import { SearchResult, WatchlistItem, StockQuote } from '@/types/stock';
import { getThaiStockName, isThaiStock } from '@/data/thaiStocks';
import ThemeRegistry from './ThemeRegistry';

// ฟังก์ชันหาธงชาติจาก symbol
const getStockFlag = (symbol: string): { flag: string; country: string } => {
  if (symbol.endsWith('.BK')) return { flag: '🇹🇭', country: 'ไทย' };
  if (symbol.endsWith('.T') || symbol.endsWith('.TYO'))
    return { flag: '🇯🇵', country: 'ญี่ปุ่น' };
  if (symbol.endsWith('.HK')) return { flag: '🇭🇰', country: 'ฮ่องกง' };
  if (symbol.endsWith('.L') || symbol.endsWith('.LON'))
    return { flag: '🇬🇧', country: 'อังกฤษ' };
  if (symbol.endsWith('.DE') || symbol.endsWith('.F'))
    return { flag: '🇩🇪', country: 'เยอรมัน' };
  if (symbol.endsWith('.TO') || symbol.endsWith('.V'))
    return { flag: '🇨🇦', country: 'แคนาดา' };
  if (symbol.endsWith('.AX')) return { flag: '🇦🇺', country: 'ออสเตรเลีย' };
  if (symbol.endsWith('.SS') || symbol.endsWith('.SZ'))
    return { flag: '🇨🇳', country: 'จีน' };
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ'))
    return { flag: '🇰🇷', country: 'เกาหลี' };
  if (symbol.endsWith('.SI')) return { flag: '🇸🇬', country: 'สิงคโปร์' };
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO'))
    return { flag: '🇮🇳', country: 'อินเดีย' };
  if (symbol.endsWith('.PA')) return { flag: '🇫🇷', country: 'ฝรั่งเศส' };
  if (symbol.endsWith('.AS')) return { flag: '🇳🇱', country: 'เนเธอร์แลนด์' };
  if (symbol.endsWith('.MC')) return { flag: '🇪🇸', country: 'สเปน' };
  if (symbol.endsWith('.MI')) return { flag: '🇮🇹', country: 'อิตาลี' };
  if (symbol.endsWith('.SW')) return { flag: '🇨🇭', country: 'สวิส' };
  // Default: สหรัฐ
  return { flag: '🇺🇸', country: 'สหรัฐ' };
};

// Sortable Row Component
interface SortableRowProps {
  item: WatchlistItem;
  quote: StockQuote | undefined;
  watchlistLoading: boolean;
  formatNumber: (num: number, decimals?: number) => string;
  formatLargeNumber: (num: number) => string;
  goToStockDetail: (symbol: string, name: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

function SortableRow({
  item,
  quote,
  watchlistLoading,
  formatNumber,
  formatLargeNumber,
  goToStockDetail,
  removeFromWatchlist,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.symbol });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const isPositive = quote ? quote.change >= 0 : true;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'rgba(15, 52, 96, 0.3)',
        },
        transition: 'background-color 0.2s, box-shadow 0.2s',
        backgroundColor: isDragging ? 'rgba(233, 69, 96, 0.15)' : 'transparent',
        boxShadow: isDragging ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
        position: isDragging ? 'relative' : 'static',
      }}
    >
      {/* Drag Handle */}
      <TableCell sx={{ width: 40, p: 1 }}>
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            color: 'text.secondary',
            '&:hover': { color: '#e94560' },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </TableCell>

      <TableCell onClick={() => goToStockDetail(item.symbol, item.name)}>
        <Typography variant="subtitle2" fontWeight={600}>
          {item.symbol}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>
            {getStockFlag(item.symbol).flag}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isThaiStock(item.symbol)
              ? getThaiStockName(item.symbol)?.name || item.name
              : item.name}
          </Typography>
        </Box>
      </TableCell>
      <TableCell
        align="right"
        onClick={() => goToStockDetail(item.symbol, item.name)}
      >
        {watchlistLoading && !quote ? (
          <Skeleton width={60} sx={{ ml: 'auto' }} />
        ) : quote ? (
          <Typography fontWeight={600} fontFamily="monospace">
            ${formatNumber(quote.price)}
          </Typography>
        ) : (
          <Typography color="text.secondary">-</Typography>
        )}
      </TableCell>
      <TableCell
        align="right"
        onClick={() => goToStockDetail(item.symbol, item.name)}
      >
        {watchlistLoading && !quote ? (
          <Skeleton width={80} sx={{ ml: 'auto' }} />
        ) : quote ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
            }}
          >
            {isPositive ? (
              <TrendingUpIcon sx={{ color: '#00c853', fontSize: 18 }} />
            ) : (
              <TrendingDownIcon sx={{ color: '#ff1744', fontSize: 18 }} />
            )}
            <Typography
              fontWeight={600}
              sx={{ color: isPositive ? '#00c853' : '#ff1744' }}
            >
              {isPositive ? '+' : ''}
              {formatNumber(quote.changePercent)}%
            </Typography>
          </Box>
        ) : (
          <Typography color="text.secondary">-</Typography>
        )}
      </TableCell>
      <TableCell
        align="right"
        onClick={() => goToStockDetail(item.symbol, item.name)}
      >
        {watchlistLoading && !quote ? (
          <Skeleton width={50} sx={{ ml: 'auto' }} />
        ) : quote ? (
          <Typography color="text.secondary">
            {formatLargeNumber(quote.volume)}
          </Typography>
        ) : (
          <Typography color="text.secondary">-</Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="ดูรายละเอียด">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                goToStockDetail(item.symbol, item.name);
              }}
              sx={{ color: 'text.secondary', '&:hover': { color: '#e94560' } }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบออกจากลิสต์">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                removeFromWatchlist(item.symbol);
              }}
              sx={{ color: 'text.secondary', '&:hover': { color: '#ff1744' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}

export default function DashboardContent() {
  const router = useRouter();
  const {
    watchlist,
    watchlistQuotes,
    loading: watchlistLoading,
    isInitialized,
    removeFromWatchlist,
    refreshWatchlistQuotes,
    reorderWatchlist,
  } = useWatchlist();

  // DnD sensors - ปรับให้ smooth ขึ้น
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // ลด distance เพื่อให้ลากได้เร็วขึ้น
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // State for active dragging item
  const [activeId, setActiveId] = useState<string | null>(null);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = watchlist.findIndex((item) => item.symbol === active.id);
      const newIndex = watchlist.findIndex((item) => item.symbol === over.id);
      const newOrder = arrayMove(watchlist, oldIndex, newIndex);
      reorderWatchlist(newOrder);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [apiSource, setApiSource] = useState<string>('Yahoo Finance');

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

  // ใช้ ref เพื่อติดตามว่าโหลดครั้งแรกหรือยัง
  const hasInitialLoad = useRef(false);

  // โหลดข้อมูล watchlist เมื่อเริ่มต้น (ครั้งแรกเท่านั้น)
  useEffect(() => {
    if (isInitialized && watchlist.length > 0 && !hasInitialLoad.current) {
      hasInitialLoad.current = true;
      refreshWatchlistQuotes();
    }
  }, [isInitialized, watchlist.length, refreshWatchlistQuotes]);

  // ค้นหาหุ้น
  const searchStock = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError(null);
    setShowSearchResults(true);

    try {
      const response = await fetch(
        `/api/stock?symbol=${encodeURIComponent(query)}&type=search`
      );
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setSearchResults([]);
        return;
      }

      if (data.bestMatches && data.bestMatches.length > 0) {
        const results: SearchResult[] = data.bestMatches.map(
          (match: Record<string, string>) => ({
            symbol: match['1. symbol'],
            name: match['2. name'],
            type: match['3. type'],
            region: match['4. region'],
            currency: match['8. currency'],
          })
        );
        setSearchResults(results);
        if (data.source) {
          setApiSource(getProviderName(data.source));
        }
      } else {
        setSearchResults([]);
        setError(`ไม่พบหุ้น "${query}"`);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการค้นหา');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounce search
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        searchStock(query);
      }, 400);
    },
    [searchStock]
  );

  // กด Enter ค้นหา
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchStock(searchQuery);
    }
  };

  // ไปหน้ารายละเอียดหุ้น
  const goToStockDetail = (symbol: string, name: string) => {
    router.push(`/stock/${symbol}?name=${encodeURIComponent(name)}`);
  };

  // เลือกหุ้นจากผลการค้นหา
  const handleSelectStock = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    goToStockDetail(result.symbol, result.name);
  };

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
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              mb: 1,
            }}
          >
            <ShowChartIcon sx={{ fontSize: 48, color: '#e94560' }} />
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #e94560 30%, #ff6b9d 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Stock Dashboard
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            ค้นหาและติดตามหุ้นที่คุณสนใจ
          </Typography>
        </Box>

        {/* Search Box */}
        <Paper
          elevation={8}
          sx={{
            mb: 3,
            p: 2,
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: 3,
            border: '1px solid rgba(233, 69, 96, 0.2)',
            position: 'relative',
          }}
        >
          <TextField
            fullWidth
            placeholder="ค้นหาหุ้น เช่น AAPL, GOOGL, MSFT, TSLA..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              debouncedSearch(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchLoading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} color="secondary" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(22, 33, 62, 0.8)',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: 'rgba(45, 45, 68, 0.8)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(233, 69, 96, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#e94560',
                },
              },
            }}
          />

          {/* Search Results Dropdown */}
          <Fade in={showSearchResults && searchResults.length > 0}>
            <Paper
              elevation={16}
              sx={{
                position: 'absolute',
                left: 16,
                right: 16,
                mt: 1,
                maxHeight: 350,
                overflow: 'auto',
                backgroundColor: 'rgba(26, 26, 46, 0.98)',
                borderRadius: 2,
                border: '1px solid rgba(233, 69, 96, 0.3)',
                zIndex: 1000,
              }}
            >
              <List disablePadding>
                {searchResults.map((result, index) => {
                  // กำหนดธงชาติและชื่อตลาดตาม region
                  const getMarketInfo = (region: string) => {
                    const markets: Record<
                      string,
                      { flag: string; name: string; color: string }
                    > = {
                      SET: { flag: '🇹🇭', name: 'SET', color: '#e94560' },
                      BKK: { flag: '🇹🇭', name: 'SET', color: '#e94560' },
                      NAS: { flag: '🇺🇸', name: 'NASDAQ', color: '#4ade80' },
                      NASDAQ: { flag: '🇺🇸', name: 'NASDAQ', color: '#4ade80' },
                      NYQ: { flag: '🇺🇸', name: 'NYSE', color: '#60a5fa' },
                      NYSE: { flag: '🇺🇸', name: 'NYSE', color: '#60a5fa' },
                      NMS: { flag: '🇺🇸', name: 'NASDAQ', color: '#4ade80' },
                      NGM: { flag: '🇺🇸', name: 'NASDAQ', color: '#4ade80' },
                      PCX: { flag: '🇺🇸', name: 'NYSE', color: '#60a5fa' },
                      FRA: { flag: '🇩🇪', name: 'Frankfurt', color: '#fbbf24' },
                      TOR: { flag: '🇨🇦', name: 'Toronto', color: '#f87171' },
                      TSX: { flag: '🇨🇦', name: 'Toronto', color: '#f87171' },
                      LON: { flag: '🇬🇧', name: 'London', color: '#818cf8' },
                      LSE: { flag: '🇬🇧', name: 'London', color: '#818cf8' },
                      HKG: { flag: '🇭🇰', name: 'HK', color: '#fb923c' },
                      HKSE: { flag: '🇭🇰', name: 'HK', color: '#fb923c' },
                      TYO: { flag: '🇯🇵', name: 'Tokyo', color: '#f472b6' },
                      JPX: { flag: '🇯🇵', name: 'Tokyo', color: '#f472b6' },
                      SHH: { flag: '🇨🇳', name: 'Shanghai', color: '#ef4444' },
                      SHZ: { flag: '🇨🇳', name: 'Shenzhen', color: '#ef4444' },
                      KSC: { flag: '🇰🇷', name: 'KOSPI', color: '#a78bfa' },
                      KOE: { flag: '🇰🇷', name: 'KOSDAQ', color: '#a78bfa' },
                      SGX: { flag: '🇸🇬', name: 'SGX', color: '#34d399' },
                      ASX: { flag: '🇦🇺', name: 'ASX', color: '#22d3d1' },
                    };
                    return (
                      markets[region] || {
                        flag: '🌐',
                        name: region,
                        color: '#9ca3af',
                      }
                    );
                  };

                  // กำหนดสีประเภทหุ้น
                  const getTypeColor = (type: string) => {
                    const types: Record<string, string> = {
                      EQUITY: '#4ade80',
                      ETF: '#60a5fa',
                      MUTUALFUND: '#fbbf24',
                      INDEX: '#f472b6',
                      CURRENCY: '#a78bfa',
                      CRYPTOCURRENCY: '#fb923c',
                    };
                    return types[type.toUpperCase()] || '#9ca3af';
                  };

                  const marketInfo = getMarketInfo(result.region);

                  return (
                    <ListItem
                      key={`${result.symbol}-${index}`}
                      onClick={() => handleSelectStock(result)}
                      sx={{
                        cursor: 'pointer',
                        borderBottom:
                          index < searchResults.length - 1
                            ? '1px solid rgba(45, 45, 68, 0.5)'
                            : 'none',
                        '&:hover': {
                          backgroundColor: 'rgba(15, 52, 96, 0.5)',
                        },
                        transition: 'background-color 0.2s',
                        py: 1.5,
                      }}
                    >
                      {/* ฝั่งซ้าย: Symbol + ชื่อบริษัท */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                          color="text.primary"
                          sx={{ lineHeight: 1.3 }}
                        >
                          {result.symbol}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.8rem',
                          }}
                        >
                          {/* แสดงชื่อไทยถ้าเป็นหุ้นไทย */}
                          {isThaiStock(result.symbol)
                            ? getThaiStockName(result.symbol)?.name ||
                              result.name
                            : result.name}
                        </Typography>
                      </Box>

                      {/* ฝั่งขวา: ธงชาติ + ตลาด + ประเภท */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          ml: 2,
                          flexShrink: 0,
                        }}
                      >
                        {/* ตลาด + ธงชาติ */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            backgroundColor: 'rgba(15, 52, 96, 0.6)',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>
                            {marketInfo.flag}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              color: marketInfo.color,
                              fontSize: '0.7rem',
                            }}
                          >
                            {marketInfo.name}
                          </Typography>
                        </Box>

                        {/* ประเภทหุ้น */}
                        <Chip
                          label={result.type}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            color: getTypeColor(result.type),
                            border: `1px solid ${getTypeColor(result.type)}40`,
                          }}
                        />
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Fade>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="warning"
            onClose={() => setError(null)}
            sx={{
              mb: 3,
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.5)',
              borderRadius: 2,
            }}
          >
            {error}
          </Alert>
        )}

        {/* Watchlist Section */}
        <Paper
          elevation={8}
          sx={{
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: 3,
            border: '1px solid rgba(233, 69, 96, 0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Watchlist Header */}
          <Box
            sx={{
              p: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(45, 45, 68, 0.5)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <BookmarkBorderIcon sx={{ color: '#e94560', fontSize: 28 }} />
              <Typography variant="h6" fontWeight={600}>
                รายการหุ้นที่สนใจ
              </Typography>
              <Chip
                label={watchlist.length}
                size="small"
                sx={{
                  backgroundColor: 'rgba(15, 52, 96, 0.8)',
                  fontWeight: 600,
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* สรุปประเทศ/ประเภท */}
              {watchlist.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
                  {(() => {
                    const countryCounts = watchlist.reduce((acc, item) => {
                      const { flag, country } = getStockFlag(item.symbol);
                      acc[flag] = acc[flag] || { count: 0, country };
                      acc[flag].count++;
                      return acc;
                    }, {} as Record<string, { count: number; country: string }>);
                    return Object.entries(countryCounts).map(([flag, data]) => (
                      <Tooltip
                        key={flag}
                        title={`${data.country} (${data.count})`}
                      >
                        <Chip
                          label={`${flag} ${data.count}`}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(15, 52, 96, 0.6)',
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </Tooltip>
                    ));
                  })()}
                </Box>
              )}
              <Tooltip title="รีเฟรชข้อมูล">
                <span>
                  <IconButton
                    onClick={refreshWatchlistQuotes}
                    disabled={watchlistLoading || watchlist.length === 0}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: '#e94560' },
                    }}
                  >
                    <RefreshIcon
                      sx={{
                        animation: watchlistLoading
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
          </Box>

          {/* Watchlist Table */}
          {watchlist.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 600,
                          width: 48,
                        }}
                      >
                        {/* Drag handle column */}
                      </TableCell>
                      <TableCell
                        sx={{ color: 'text.secondary', fontWeight: 600 }}
                      >
                        หุ้น
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'text.secondary', fontWeight: 600 }}
                      >
                        ราคา
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'text.secondary', fontWeight: 600 }}
                      >
                        เปลี่ยนแปลง
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'text.secondary', fontWeight: 600 }}
                      >
                        ปริมาณ
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ color: 'text.secondary', fontWeight: 600 }}
                      >
                        จัดการ
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <SortableContext
                    items={watchlist.map((item) => item.symbol)}
                    strategy={verticalListSortingStrategy}
                  >
                    <TableBody>
                      {watchlist.map((item) => (
                        <SortableRow
                          key={item.symbol}
                          item={item}
                          quote={watchlistQuotes.get(item.symbol)}
                          watchlistLoading={watchlistLoading}
                          formatNumber={formatNumber}
                          formatLargeNumber={formatLargeNumber}
                          goToStockDetail={goToStockDetail}
                          removeFromWatchlist={removeFromWatchlist}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </TableContainer>
            </DndContext>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
              <BookmarkBorderIcon
                sx={{
                  fontSize: 64,
                  color: 'text.secondary',
                  opacity: 0.3,
                  mb: 2,
                }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                ยังไม่มีหุ้นในรายการที่สนใจ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ค้นหาหุ้นและเพิ่มเข้ารายการเพื่อติดตามราคา
              </Typography>
            </Box>
          )}
        </Paper>

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
