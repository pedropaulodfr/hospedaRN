import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

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

const lightPalette: ThemeOptions['palette'] = {
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
};

const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: {
    main: '#26C6DA',
    light: '#4DD0E1',
    dark: '#0097A7',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#FF8A65',
    light: '#FFAB91',
    dark: '#FF7043',
    contrastText: '#ffffff',
  },
  oceanBlue: {
    main: '#26C6DA',
    light: '#4DD0E1',
    dark: '#0097A7',
    contrastText: '#ffffff',
  },
  sunriseOrange: {
    main: '#FF8A65',
    light: '#FFAB91',
    dark: '#FF7043',
    contrastText: '#ffffff',
  },
  background: {
    default: '#0f172a',
    paper: '#1e293b',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
  },
  success: {
    main: '#34D399',
    light: '#6EE7B7',
    dark: '#10B981',
  },
  warning: {
    main: '#FBBF24',
    light: '#FCD34D',
    dark: '#F59E0B',
  },
  error: {
    main: '#F87171',
    light: '#FCA5A5',
    dark: '#EF4444',
  },
  divider: 'rgba(255,255,255,0.08)',
};

const commonComponents: ThemeOptions['components'] = {
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
      root: ({ theme }) => ({
        borderRadius: 16,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 2px 12px rgba(0,0,0,0.3)'
          : '0 2px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 8px 32px rgba(0,0,0,0.12)',
          transform: 'translateY(-2px)',
        },
      }),
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiOutlinedInput-root': {
          borderRadius: 10,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
          },
        },
      }),
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
      elevation1: ({ theme }) => ({
        boxShadow: theme.palette.mode === 'dark'
          ? '0 2px 12px rgba(0,0,0,0.3)'
          : '0 2px 12px rgba(0,0,0,0.06)',
      }),
      elevation2: ({ theme }) => ({
        boxShadow: theme.palette.mode === 'dark'
          ? '0 4px 20px rgba(0,0,0,0.35)'
          : '0 4px 20px rgba(0,0,0,0.08)',
      }),
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(30,41,59,0.92)'
          : 'rgba(255,255,255,0.92)',
        color: theme.palette.text.primary,
      }),
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRight: `1px solid ${theme.palette.divider}`,
        boxShadow: '4px 0 20px rgba(0,0,0,0.06)',
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      head: ({ theme }) => ({
        fontWeight: 600,
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255,255,255,0.04)'
          : '#F8FAFC',
        color: theme.palette.text.secondary,
        fontSize: '0.8125rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }),
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
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundImage: 'none',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 24px 80px rgba(0,0,0,0.5)'
          : '0 24px 80px rgba(0,0,0,0.12)',
      }),
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundImage: 'none',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.1)',
      }),
    },
  },
};

const typography = {
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
};

const shape = {
  borderRadius: 12,
};

export function getTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: mode === 'dark' ? darkPalette : lightPalette,
    typography,
    shape,
    components: commonComponents,
  });
}

const hospedaRNTheme = getTheme('light');

export default hospedaRNTheme;
