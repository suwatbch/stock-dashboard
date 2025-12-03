'use client';

import { useState, useMemo, ReactNode } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

// สร้าง Emotion cache สำหรับ SSR
function createEmotionCache() {
  return createCache({ key: 'mui', prepend: true });
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e94560',
    },
    secondary: {
      main: '#ff6b9d',
    },
    background: {
      default: '#0f0f1a',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#94a3b8',
    },
    success: {
      main: '#00c853',
    },
    error: {
      main: '#ff1744',
    },
    warning: {
      main: '#ffc107',
    },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#16213e',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#2d2d44',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#0f3460',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(45, 45, 68, 0.5)',
        },
      },
    },
  },
});

interface ThemeRegistryProps {
  children: ReactNode;
}

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  const [cache] = useState(() => createEmotionCache());

  useServerInsertedHTML(() => {
    const names = Object.keys(cache.inserted);
    if (names.length === 0) return null;

    let styles = '';
    for (const name of names) {
      const value = cache.inserted[name];
      if (typeof value === 'string') {
        styles += value;
      }
    }

    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  const memoizedTheme = useMemo(() => darkTheme, []);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={memoizedTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
