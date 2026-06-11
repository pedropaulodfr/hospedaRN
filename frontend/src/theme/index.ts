import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    oceanBlue: Palette['primary'];
    sunriseOrange: Palette['primary'];
  }
  interface PaletteOptions {
    oceanBlue?: PaletteOptions['primary'];
    sunriseOrange?: PaletteOptions['primary'];
  }
}

const hospedaRNTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0097A7',
      light: '#00BCD4',
      dark: '#006978',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FF7043',
      light: '#FF8A65',
      dark: '#E64A19',
      contrastText: '#ffffff',
    },
    oceanBlue: {
      main: '#0097A7',
      light: '#00BCD4',
      dark: '#006978',
      contrastText: '#ffffff',
    },
    sunriseOrange: {
      main: '#FF7043',
      light: '#FF8A65',
      dark: '#E64A19',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A2332',
      secondary: '#64748B',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    divider: 'rgba(0,0,0,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Outfit", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 700,
    },
    h4: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.9375rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease',
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            background: 'linear-gradient(135deg, #0097A7 0%, #00BCD4 100%)',
            color: '#ffffff',
            '&:hover': {
              background: 'linear-gradient(135deg, #006978 0%, #0097A7 100%)',
            },
          },
        },
        {
          props: { variant: 'contained', color: 'secondary' },
          style: {
            background: 'linear-gradient(135deg, #FF7043 0%, #FF8A65 100%)',
            color: '#ffffff',
            '&:hover': {
              background: 'linear-gradient(135deg, #E64A19 0%, #FF7043 100%)',
            },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#0097A7',
            },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          overflow: 'visible',
          textOverflow: 'clip',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255,255,255,0.92)',
          color: '#1A2332',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '4px 0 20px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
          color: '#475569',
          fontSize: '0.8125rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 700,
        },
        colorDefault: {
          background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
          color: '#ffffff',
        },
      },
    },
  },
});

export default hospedaRNTheme;
