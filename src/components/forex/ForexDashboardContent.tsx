'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ShowChart as ShowChartIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CurrencyExchange as CurrencyExchangeIcon,
  Add as AddIcon,
  DragIndicator as DragIndicatorIcon,
  AccountCircle as AccountCircleIcon,
  AccountBalanceWallet as WalletIcon,
  Close as CloseIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import {
  FOREX_PAIRS,
  ForexQuote,
  ForexPair,
  FOREX_COLORS,
} from '@/types/forex';
import ForexChart from './ForexChart';
import ThemeRegistry from '../ThemeRegistry';

const FOREX_PAIR_ORDER_KEY = 'forex_pair_order';

// Sortable Mini Card สำหรับเลือกคู่เงิน
interface SortableMiniPairCardProps {
  pair: ForexPair;
  quote?: ForexQuote;
  loading?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

function SortableMiniPairCard({
  pair,
  quote,
  loading,
  selected,
  onClick,
  onRemove,
  canRemove = true,
}: SortableMiniPairCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pair.symbol });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const isPositive = quote && quote.change >= 0;

  const formatPrice = (price: number) => {
    if (!price) return '-';
    const decimals = pair.quote === 'JPY' || pair.quote === 'THB' ? 3 : 5;
    return price.toFixed(decimals);
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        p: 1.5,
        cursor: isDragging ? 'grabbing' : 'pointer',
        bgcolor: selected
          ? 'rgba(38, 166, 154, 0.15)'
          : isDragging
          ? 'rgba(233, 69, 96, 0.15)'
          : FOREX_COLORS.card,
        border: `2px solid ${
          selected ? '#26a69a' : isDragging ? '#e94560' : FOREX_COLORS.border
        }`,
        borderRadius: 2,
        transition: 'background-color 0.2s, border-color 0.2s',
        minWidth: 140,
        boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.4)' : 'none',
        '&:hover': {
          bgcolor: isDragging
            ? 'rgba(233, 69, 96, 0.15)'
            : 'rgba(38, 166, 154, 0.1)',
          borderColor: isDragging ? '#e94560' : '#26a69a',
        },
      }}
    >
      {/* Header with Drag Handle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            color: FOREX_COLORS.textSecondary,
            '&:hover': { color: '#e94560' },
            '&:active': { cursor: 'grabbing' },
            mr: 0.5,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ fontSize: '1rem' }}>{pair.flag1}</Typography>
        <Typography sx={{ fontSize: '1rem' }}>{pair.flag2}</Typography>
        <Typography
          onClick={onClick}
          sx={{
            fontWeight: 700,
            fontSize: '0.8rem',
            color: selected ? '#26a69a' : FOREX_COLORS.text,
            ml: 0.5,
            cursor: 'pointer',
            flex: 1,
          }}
        >
          {pair.symbol}
        </Typography>
        {/* ปุ่มลบ */}
        {canRemove && onRemove && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: FOREX_COLORS.textSecondary,
              '&:hover': { color: '#ef5350' },
              ml: 'auto',
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
      </Box>

      {/* Price - Clickable */}
      <Box onClick={onClick} sx={{ cursor: 'pointer', position: 'relative' }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            color: FOREX_COLORS.text,
            fontFamily: 'monospace',
            opacity: loading && !quote ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {formatPrice(quote?.price || 0)}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: isPositive ? FOREX_COLORS.success : FOREX_COLORS.danger,
            fontFamily: 'monospace',
            opacity: loading && !quote ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {isPositive ? '+' : ''}
          {quote?.changePercent?.toFixed(2) || '0.00'}%
        </Typography>
        {/* Loading indicator - จุดเล็กๆ */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#26a69a',
              animation: 'pulse 1s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.3 },
                '100%': { opacity: 1 },
              },
            }}
          />
        )}
      </Box>
    </Paper>
  );
}

// Add Card สำหรับเพิ่มคู่เงิน (หลอก)
function AddPairCard() {
  return (
    <Paper
      sx={{
        p: 1.5,
        cursor: 'pointer',
        bgcolor: FOREX_COLORS.card,
        border: `2px dashed ${FOREX_COLORS.border}`,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        minWidth: 70,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover': {
          borderColor: '#26a69a',
          bgcolor: 'rgba(38, 166, 154, 0.05)',
        },
      }}
    >
      <AddIcon
        sx={{ fontSize: 22, color: FOREX_COLORS.textSecondary, mb: 0.5 }}
      />
      <Typography
        sx={{ fontSize: '0.6rem', color: FOREX_COLORS.textSecondary }}
      >
        เพิ่มคู่เงิน
      </Typography>
    </Paper>
  );
}

// Reset Card สำหรับรีเซ็ตคู่เงินกลับค่าเริ่มต้น
interface ResetPairCardProps {
  onReset: () => void;
}

function ResetPairCard({ onReset }: ResetPairCardProps) {
  return (
    <Paper
      onClick={onReset}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        bgcolor: FOREX_COLORS.card,
        border: `2px dashed ${FOREX_COLORS.border}`,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        minWidth: 70,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover': {
          borderColor: '#ef5350',
          bgcolor: 'rgba(239, 83, 80, 0.05)',
        },
      }}
    >
      <RestartAltIcon
        sx={{ fontSize: 22, color: FOREX_COLORS.textSecondary, mb: 0.5 }}
      />
      <Typography
        sx={{ fontSize: '0.6rem', color: FOREX_COLORS.textSecondary }}
      >
        รีเซ็ต
      </Typography>
    </Paper>
  );
}

// Profile Card - แสดงข้อมูลบัญชีหลอก
function ProfileCard() {
  const [balance] = useState(10000.0); // ยอดเงินหลอก

  return (
    <Paper
      sx={{
        p: 1.5,
        bgcolor: FOREX_COLORS.card,
        border: `2px solid ${FOREX_COLORS.border}`,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 250,
        maxHeight: 96.5,
      }}
    >
      {/* Left Section - Balance Info */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Demo Balance Label */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 0.3,
          }}
        >
          <WalletIcon
            sx={{ fontSize: 14, color: FOREX_COLORS.textSecondary }}
          />
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: FOREX_COLORS.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Demo Balance
          </Typography>
        </Box>

        {/* Balance + Active */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 0,
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.15rem',
              color: FOREX_COLORS.text,
              fontFamily: 'monospace',
              lineHeight: 1.2,
            }}
          >
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#26a69a',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                  '100%': { opacity: 1 },
                },
              }}
            />
            <Typography
              sx={{ fontSize: '0.65rem', color: FOREX_COLORS.textSecondary }}
            >
              Active
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right Section - Avatar (centered vertically) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #26a69a 0%, #2bbd9e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(38, 166, 154, 0.3)',
          }}
        >
          <AccountCircleIcon sx={{ fontSize: 36, color: '#fff' }} />
        </Box>
      </Box>
    </Paper>
  );
}

export default function ForexDashboardContent() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Map<string, ForexQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [orderedPairs, setOrderedPairs] = useState<ForexPair[]>(FOREX_PAIRS);
  const [selectedPair, setSelectedPair] = useState(FOREX_PAIRS[0].symbol);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // โหลดลำดับคู่เงินจาก localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem(FOREX_PAIR_ORDER_KEY);
    if (savedOrder) {
      try {
        const orderSymbols: string[] = JSON.parse(savedOrder);
        // จัดเรียงตาม saved order
        const reordered = orderSymbols
          .map((symbol) => FOREX_PAIRS.find((p) => p.symbol === symbol))
          .filter((p): p is ForexPair => p !== undefined);

        // เพิ่มคู่เงินที่อาจจะเพิ่มใหม่ (ไม่อยู่ใน saved order)
        FOREX_PAIRS.forEach((pair) => {
          if (!reordered.find((p) => p.symbol === pair.symbol)) {
            reordered.push(pair);
          }
        });

        setOrderedPairs(reordered);
        setSelectedPair(reordered[0]?.symbol || FOREX_PAIRS[0].symbol);
      } catch {
        console.error('Failed to parse saved forex order');
      }
    }
    setIsInitialized(true);
  }, []);

  // บันทึกลำดับคู่เงินลง localStorage
  useEffect(() => {
    if (isInitialized) {
      const orderSymbols = orderedPairs.map((p) => p.symbol);
      localStorage.setItem(FOREX_PAIR_ORDER_KEY, JSON.stringify(orderSymbols));
    }
  }, [orderedPairs, isInitialized]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedPairs((pairs) => {
        const oldIndex = pairs.findIndex((p) => p.symbol === active.id);
        const newIndex = pairs.findIndex((p) => p.symbol === over.id);
        return arrayMove(pairs, oldIndex, newIndex);
      });
    }
  };

  // ลบคู่เงิน
  const removePair = (symbol: string) => {
    if (orderedPairs.length <= 1) return; // ต้องมีอย่างน้อย 1 คู่

    setOrderedPairs((pairs) => {
      const newPairs = pairs.filter((p) => p.symbol !== symbol);
      // ถ้าลบคู่เงินที่กำลังเลือกอยู่ ให้เลือกคู่แรก
      if (selectedPair === symbol && newPairs.length > 0) {
        setSelectedPair(newPairs[0].symbol);
      }
      return newPairs;
    });
  };

  // รีเซ็ตกลับค่าเริ่มต้น
  const resetPairs = () => {
    setOrderedPairs([...FOREX_PAIRS]);
    setSelectedPair(FOREX_PAIRS[0].symbol);
    localStorage.removeItem(FOREX_PAIR_ORDER_KEY);
  };

  // ดึงข้อมูล quotes ทั้งหมด
  const fetchQuotes = useCallback(async (isInitial = false) => {
    try {
      // เฉพาะครั้งแรกให้แสดง loading, หลังจากนั้นให้อัปเดทเงียบๆ
      if (isInitial) setLoading(true);

      const symbols = FOREX_PAIRS.map((p) => p.symbol).join(',');
      const response = await fetch(
        `/api/forex?action=quotes&symbols=${encodeURIComponent(symbols)}`
      );

      if (!response.ok) throw new Error('Failed to fetch quotes');

      const data = await response.json();
      const quotesMap = new Map<string, ForexQuote>();

      data.forEach((q: ForexQuote) => {
        if (q) quotesMap.set(q.symbol, q);
      });

      setQuotes(quotesMap);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching forex quotes:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Initial fetch & auto refresh
  useEffect(() => {
    fetchQuotes(true); // ครั้งแรกให้ loading

    // Auto refresh ทุก 30 วินาที - อัปเดทเงียบๆ
    const interval = setInterval(() => fetchQuotes(false), 30000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok',
    }).format(date);
  };

  const selectedQuote = quotes.get(selectedPair);
  const selectedPairData = FOREX_PAIRS.find((p) => p.symbol === selectedPair);

  return (
    <ThemeRegistry>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: FOREX_COLORS.background,
          p: 3,
        }}
      >
        <Container maxWidth="xl">
          {/* Navigation Toggle */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              value="forex"
              exclusive
              onChange={(_, value) => {
                if (value === 'stock') {
                  router.push('/');
                }
              }}
              sx={{
                bgcolor: 'rgba(26, 26, 46, 0.95)',
                border: '1px solid rgba(233, 69, 96, 0.3)',
                borderRadius: 2,
                '& .MuiToggleButton-root': {
                  color: '#94a3b8',
                  border: 'none',
                  px: 3,
                  py: 1,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(233, 69, 96, 0.2)',
                    color: '#e94560',
                    '&:hover': {
                      bgcolor: 'rgba(233, 69, 96, 0.3)',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  },
                },
              }}
            >
              <ToggleButton value="stock">
                <ShowChartIcon sx={{ mr: 1 }} />
                Stock
              </ToggleButton>
              <ToggleButton value="forex">
                <CurrencyExchangeIcon sx={{ mr: 1 }} />
                Forex
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ShowChartIcon
                sx={{ fontSize: 32, color: FOREX_COLORS.highlight }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: FOREX_COLORS.text,
                }}
              >
                Forex Dashboard
              </Typography>
              <Chip
                label="Real-time"
                size="small"
                sx={{
                  bgcolor: FOREX_COLORS.success + '20',
                  color: FOREX_COLORS.success,
                  fontWeight: 600,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {lastUpdate && (
                <Tooltip title="เวลาอัพเดทล่าสุด">
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                    label={formatDateTime(lastUpdate)}
                    size="small"
                    sx={{
                      bgcolor: FOREX_COLORS.card,
                      color: FOREX_COLORS.textSecondary,
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title="รีเฟรช">
                <IconButton
                  onClick={() => fetchQuotes(false)}
                  sx={{
                    color: FOREX_COLORS.text,
                    bgcolor: FOREX_COLORS.card,
                    '&:hover': { bgcolor: FOREX_COLORS.accent },
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Currency Pair Cards - Horizontal with Drag & Drop + Profile */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 2,
              mb: 3,
            }}
          >
            {/* Sortable Pairs */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={orderedPairs.map((p) => p.symbol)}
                strategy={horizontalListSortingStrategy}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    flex: 1,
                    overflowX: 'auto',
                    pb: 1,
                    '&::-webkit-scrollbar': {
                      height: 6,
                    },
                    '&::-webkit-scrollbar-track': {
                      bgcolor: FOREX_COLORS.border,
                      borderRadius: 3,
                    },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: FOREX_COLORS.textSecondary,
                      borderRadius: 3,
                    },
                  }}
                >
                  {orderedPairs.map((pair) => (
                    <SortableMiniPairCard
                      key={pair.symbol}
                      pair={pair}
                      quote={quotes.get(pair.symbol)}
                      loading={loading}
                      selected={selectedPair === pair.symbol}
                      onClick={() => setSelectedPair(pair.symbol)}
                      onRemove={() => removePair(pair.symbol)}
                      canRemove={orderedPairs.length > 1}
                    />
                  ))}
                  <AddPairCard />
                  <ResetPairCard onReset={resetPairs} />
                </Box>
              </SortableContext>
            </DndContext>

            {/* Profile Card - ชิดขวา */}
            <ProfileCard />
          </Box>

          {/* Main Content - Chart & Details */}
          <Grid container spacing={3}>
            {/* Price Info Panel */}
            <Grid size={{ xs: 12, lg: 3 }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: FOREX_COLORS.card,
                  borderRadius: 2,
                  height: '100%',
                }}
              >
                {/* Selected Pair Info */}
                <Box sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: '1.5rem' }}>
                      {selectedPairData?.flag1}
                    </Typography>
                    <Typography sx={{ fontSize: '1.5rem' }}>
                      {selectedPairData?.flag2}
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: FOREX_COLORS.text }}
                  >
                    {selectedPair}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      color: FOREX_COLORS.textSecondary,
                    }}
                  >
                    {selectedPairData?.name}
                  </Typography>
                </Box>

                {/* Current Price */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color: FOREX_COLORS.text,
                      fontFamily: 'monospace',
                    }}
                  >
                    {selectedQuote?.price?.toFixed(
                      selectedPairData?.quote === 'JPY' ||
                        selectedPairData?.quote === 'THB'
                        ? 3
                        : 5
                    ) || '-'}
                  </Typography>
                  {selectedQuote && (
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {selectedQuote.change >= 0 ? (
                        <TrendingUpIcon
                          sx={{ fontSize: 18, color: FOREX_COLORS.success }}
                        />
                      ) : (
                        <TrendingDownIcon
                          sx={{ fontSize: 18, color: FOREX_COLORS.danger }}
                        />
                      )}
                      <Typography
                        sx={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color:
                            selectedQuote.change >= 0
                              ? FOREX_COLORS.success
                              : FOREX_COLORS.danger,
                        }}
                      >
                        {selectedQuote.change >= 0 ? '+' : ''}
                        {selectedQuote.change?.toFixed(5)} (
                        {selectedQuote.changePercent?.toFixed(2)}%)
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ bgcolor: FOREX_COLORS.border, my: 2 }} />

                {/* Price Details */}
                {selectedQuote && (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
                  >
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        BID
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.bid,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.bid?.toFixed(5)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        ASK
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.ask,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.ask?.toFixed(5)}
                      </Typography>
                    </Box>
                    <Divider sx={{ bgcolor: FOREX_COLORS.border }} />
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        HIGH
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.text,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.high?.toFixed(5)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        LOW
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.text,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.low?.toFixed(5)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        OPEN
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.text,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.open?.toFixed(5)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: FOREX_COLORS.textSecondary,
                        }}
                      >
                        PREV CLOSE
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: FOREX_COLORS.text,
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedQuote.previousClose?.toFixed(5)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Chart Panel */}
            <Grid size={{ xs: 12, lg: 9 }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: FOREX_COLORS.card,
                  borderRadius: 2,
                }}
              >
                <ForexChart symbol={selectedPair} height={550} />
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeRegistry>
  );
}
