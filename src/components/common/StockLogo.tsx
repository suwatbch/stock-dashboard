'use client';

import { useState } from 'react';
import { Box, Avatar } from '@mui/material';

interface StockLogoProps {
  symbol: string;
  name: string;
  size?: { xs: number; sm: number } | number;
}

// Map of well-known stock symbols to their company domains
const SYMBOL_TO_DOMAIN: Record<string, string> = {
  // US Tech Giants
  AAPL: 'apple.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  NVDA: 'nvidia.com',
  TSLA: 'tesla.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  INTC: 'intel.com',
  CRM: 'salesforce.com',
  ORCL: 'oracle.com',
  ADBE: 'adobe.com',
  CSCO: 'cisco.com',
  IBM: 'ibm.com',
  QCOM: 'qualcomm.com',
  TXN: 'ti.com',
  AVGO: 'broadcom.com',
  ASML: 'asml.com',
  TSM: 'tsmc.com',
  
  // Finance & Banking
  V: 'visa.com',
  MA: 'mastercard.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  GS: 'goldmansachs.com',
  MS: 'morganstanley.com',
  AXP: 'americanexpress.com',
  PYPL: 'paypal.com',
  SQ: 'squareup.com',
  C: 'citi.com',
  
  // Retail & Consumer
  WMT: 'walmart.com',
  COST: 'costco.com',
  HD: 'homedepot.com',
  TGT: 'target.com',
  NKE: 'nike.com',
  SBUX: 'starbucks.com',
  MCD: 'mcdonalds.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  DIS: 'disney.com',
  
  // Healthcare
  JNJ: 'jnj.com',
  PFE: 'pfizer.com',
  UNH: 'unitedhealthgroup.com',
  ABBV: 'abbvie.com',
  MRK: 'merck.com',
  LLY: 'lilly.com',
  
  // Energy
  XOM: 'exxonmobil.com',
  CVX: 'chevron.com',
  
  // Other
  BA: 'boeing.com',
  CAT: 'cat.com',
  UPS: 'ups.com',
  FDX: 'fedex.com',
  MMM: '3m.com',
};

// Get logo URL - try multiple sources
const getLogoUrls = (symbol: string): string[] => {
  const cleanSymbol = symbol.split('.')[0].toUpperCase();
  const urls: string[] = [];
  
  // 1. First try EODHD
  urls.push(`https://eodhd.com/img/logos/US/${cleanSymbol}.png`);
  
  // 2. If we have a known domain, try Clearbit/Google logo service
  const domain = SYMBOL_TO_DOMAIN[cleanSymbol];
  if (domain) {
    // Use Google's favicon service as backup (more reliable)
    urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    // Clearbit-style (via companyenrich)
    urls.push(`https://logo.clearbit.com/${domain}`);
  }
  
  return urls;
};

// Get first letter for fallback
const getInitial = (symbol: string): string => {
  const cleanSymbol = symbol.split('.')[0].toUpperCase();
  return cleanSymbol.charAt(0);
};

// Generate a consistent color based on symbol
const getColorFromSymbol = (symbol: string): string => {
  const colors = [
    '#e94560', // red-pink
    '#4ade80', // green
    '#60a5fa', // blue
    '#fbbf24', // yellow
    '#a78bfa', // purple
    '#f472b6', // pink
    '#22d3d1', // cyan
    '#fb923c', // orange
  ];
  
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function StockLogo({ symbol, name, size = { xs: 28, sm: 36 } }: StockLogoProps) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  
  const urls = getLogoUrls(symbol);
  
  const handleImageError = () => {
    // Try next URL
    if (urlIndex < urls.length - 1) {
      setUrlIndex(urlIndex + 1);
    } else {
      // All URLs failed, show fallback
      setAllFailed(true);
    }
  };

  const sizeValue = typeof size === 'number' ? size : size;
  const bgColor = getColorFromSymbol(symbol);
  const initial = getInitial(symbol);

  return (
    <Box
      sx={{
        width: typeof sizeValue === 'number' ? sizeValue : sizeValue,
        height: typeof sizeValue === 'number' ? sizeValue : sizeValue,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!allFailed ? (
        <Box
          component="img"
          src={urls[urlIndex]}
          alt={name}
          onError={handleImageError}
          sx={{
            width: sizeValue,
            height: sizeValue,
            borderRadius: '50%',
            objectFit: 'cover',
            bgcolor: 'rgba(255,255,255,0.1)',
          }}
        />
      ) : (
        <Avatar
          sx={{
            width: sizeValue,
            height: sizeValue,
            bgcolor: bgColor,
            fontSize: typeof sizeValue === 'number' 
              ? sizeValue * 0.5 
              : { xs: (sizeValue as { xs: number; sm: number }).xs * 0.5, sm: (sizeValue as { xs: number; sm: number }).sm * 0.5 },
            fontWeight: 700,
          }}
        >
          {initial}
        </Avatar>
      )}
    </Box>
  );
}
