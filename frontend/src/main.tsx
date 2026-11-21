import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import 'leaflet/dist/leaflet.css';
import App from './App';
import { getTheme } from './theme';
import { useThemeStore } from './stores/themeStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedApp() {
  const mode = useThemeStore((state) => state.mode);

  // Um único tema por modo — evita recriar o objeto a cada render.
  const theme = React.useMemo(() => getTheme(mode), [mode]);

  React.useEffect(() => {
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
      <Toaster
        position="bottom-right"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 12,
            boxShadow:
              mode === 'dark'
                ? '0 12px 32px rgba(0,0,0,0.55)'
                : '0 12px 32px rgba(15,23,42,0.12)',
            fontFamily: '"Inter", sans-serif',
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '12px 16px',
            maxWidth: 420,
          },
          success: {
            iconTheme: {
              primary: theme.palette.success.main,
              secondary: theme.palette.background.paper,
            },
          },
          error: {
            iconTheme: {
              primary: theme.palette.error.main,
              secondary: theme.palette.background.paper,
            },
          },
          loading: {
            iconTheme: {
              primary: theme.palette.primary.main,
              secondary: theme.palette.background.paper,
            },
          },
        }}
      />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  </React.StrictMode>,
);
