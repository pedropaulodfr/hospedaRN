import { createTheme, alpha, responsiveFontSizes } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';
import { radius, motion, touchTarget } from './tokens';

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

/* -------------------------------------------------------------------------- */
/*  Paleta                                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Contraste verificado (WCAG 2.1) — ver `theme/tokens.ts` para a semântica.
 * | cor            | sobre #FFFFFF | uso                          |
 * |----------------|---------------|------------------------------|
 * | primary #0C6A76| 6.29:1        | AA — texto, botão, link      |
 * | secondary #C2410C | 5.18:1     | AA — acento, destaque        |
 * | text.secondary #475569 | 7.58:1 | AA — texto de apoio         |
 *
 * Regra: `main` é sempre a variante legível sobre `background.default`;
 * `light` é para superfícies suaves (chips, ícones), não para texto.
 */
const sharedPalette = {
  primary: {
    light: '#2A96A3',
    dark: '#084A54',
  },
  secondary: {
    light: '#E2622F',
    dark: '#8A2E08',
  },
} as const;

const lightPalette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: {
    main: '#0C6A76',
    light: sharedPalette.primary.light,
    dark: sharedPalette.primary.dark,
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#C2410C',
    light: sharedPalette.secondary.light,
    dark: sharedPalette.secondary.dark,
    contrastText: '#FFFFFF',
  },
  oceanBlue: {
    main: '#0C6A76',
    light: sharedPalette.primary.light,
    dark: sharedPalette.primary.dark,
    contrastText: '#FFFFFF',
  },
  sunriseOrange: {
    main: '#C2410C',
    light: sharedPalette.secondary.light,
    dark: sharedPalette.secondary.dark,
    contrastText: '#FFFFFF',
  },
  success: { main: '#047857', light: '#10B981', dark: '#065F46', contrastText: '#FFFFFF' },
  warning: { main: '#B45309', light: '#F59E0B', dark: '#92400E', contrastText: '#FFFFFF' },
  error: { main: '#BE123C', light: '#EF4444', dark: '#9F1239', contrastText: '#FFFFFF' },
  info: { main: '#0369A1', light: '#0EA5E9', dark: '#075985', contrastText: '#FFFFFF' },
  background: { default: '#F6F8FA', paper: '#FFFFFF' },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    disabled: 'rgba(15,23,42,0.38)',
  },
  divider: 'rgba(15,23,42,0.09)',
  action: {
    hover: 'rgba(12,106,118,0.06)',
    selected: 'rgba(12,106,118,0.10)',
    focus: 'rgba(12,106,118,0.16)',
    disabled: 'rgba(15,23,42,0.26)',
    disabledBackground: 'rgba(15,23,42,0.08)',
  },
};

const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: {
    main: '#2DD4BF',
    light: '#5EEAD4',
    dark: '#14B8A6',
    contrastText: '#04231F',
  },
  secondary: {
    main: '#FB923C',
    light: '#FDBA74',
    dark: '#EA580C',
    contrastText: '#2A1205',
  },
  oceanBlue: {
    main: '#2DD4BF',
    light: '#5EEAD4',
    dark: '#14B8A6',
    contrastText: '#04231F',
  },
  sunriseOrange: {
    main: '#FB923C',
    light: '#FDBA74',
    dark: '#EA580C',
    contrastText: '#2A1205',
  },
  success: { main: '#34D399', light: '#6EE7B7', dark: '#10B981', contrastText: '#04231F' },
  warning: { main: '#FBBF24', light: '#FCD34D', dark: '#F59E0B', contrastText: '#2A1B02' },
  error: { main: '#FB7185', light: '#FDA4AF', dark: '#F43F5E', contrastText: '#2A0510' },
  info: { main: '#38BDF8', light: '#7DD3FC', dark: '#0EA5E9', contrastText: '#04202E' },
  background: { default: '#0B1220', paper: '#111C2E' },
  text: {
    primary: '#F0F4F8',
    secondary: '#94A3B8',
    disabled: 'rgba(240,244,248,0.38)',
  },
  divider: 'rgba(255,255,255,0.10)',
  action: {
    hover: 'rgba(45,212,191,0.08)',
    selected: 'rgba(45,212,191,0.14)',
    focus: 'rgba(45,212,191,0.20)',
    disabled: 'rgba(240,244,248,0.26)',
    disabledBackground: 'rgba(255,255,255,0.08)',
  },
};

/* -------------------------------------------------------------------------- */
/*  Tipografia                                                                */
/* -------------------------------------------------------------------------- */
/**
 * Base 16px, entrelinha 1.5–1.6 no corpo. Escala modular ~1.25.
 * `Outfit` para títulos (display), `Inter` para interface e leitura.
 * Nada abaixo de 12px — legendas ficam em 0.75rem.
 */
const typography: ThemeOptions['typography'] = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontFamily: '"Outfit", sans-serif', fontWeight: 800, fontSize: '3rem', lineHeight: 1.08, letterSpacing: '-0.03em' },
  h2: { fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '2.25rem', lineHeight: 1.14, letterSpacing: '-0.025em' },
  h3: { fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
  h4: { fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.015em' },
  h5: { fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.35, letterSpacing: '-0.01em' },
  h6: { fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, letterSpacing: '-0.005em' },
  subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.6 },
  caption: { fontSize: '0.75rem', lineHeight: 1.45, letterSpacing: '0.005em' },
  overline: { fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.09em' },
  button: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '0.005em', textTransform: 'none' },
};

/* -------------------------------------------------------------------------- */
/*  Componentes                                                               */
/* -------------------------------------------------------------------------- */
const components: ThemeOptions['components'] = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      html: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
      'html, body, #root': { minHeight: '100%' },
      body: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      },
      '*::selection': {
        backgroundColor: alpha(theme.palette.primary.main, 0.22),
        color: theme.palette.text.primary,
      },
      // Foco visível e consistente em toda a aplicação (teclado).
      ':focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
      'a': { color: 'inherit' },
      // Respeita usuários sensíveis a movimento.
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
      // Barra de rolagem discreta (Chromium/WebKit); Firefox usa scrollbar-*.
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: `${alpha(theme.palette.text.primary, 0.2)} transparent`,
      },
      '*::-webkit-scrollbar': { width: 10, height: 10 },
      '*::-webkit-scrollbar-track': { background: 'transparent' },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: alpha(theme.palette.text.primary, 0.18),
        borderRadius: 999,
        border: '2px solid transparent',
        backgroundClip: 'content-box',
      },
      '*::-webkit-scrollbar-thumb:hover': {
        backgroundColor: alpha(theme.palette.text.primary, 0.3),
      },
    }),
  },

  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        minHeight: 42,
        paddingInline: theme.spacing(2.5),
        transition: `background-color ${motion.fast} ${motion.easing}, border-color ${motion.fast} ${motion.easing}, box-shadow ${motion.fast} ${motion.easing}, color ${motion.fast} ${motion.easing}`,
        '&:active': { transform: 'none' },
        '&.Mui-focusVisible': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.28)}`,
        },
      }),
      sizeSmall: { minHeight: 36, paddingInline: 16, fontSize: '0.8125rem', borderRadius: radius.sm },
      sizeLarge: { minHeight: 50, paddingInline: 28, fontSize: '1rem', borderRadius: radius.lg },
      contained: ({ theme }) => ({
        boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.12)}`,
        '&.MuiButton-colorPrimary:hover': {
          backgroundColor: theme.palette.primary.dark,
          boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.28)}`,
        },
        '&.MuiButton-colorSecondary:hover': {
          backgroundColor: theme.palette.secondary.dark,
          boxShadow: `0 4px 14px ${alpha(theme.palette.secondary.main, 0.28)}`,
        },
      }),
      outlined: ({ theme }) => ({
        borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.22) : alpha(theme.palette.text.primary, 0.16),
        '&:hover': {
          borderColor: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
        },
      }),
      text: ({ theme }) => ({
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.07) },
      }),
      startIcon: { marginRight: 8, marginLeft: 0 },
      endIcon: { marginLeft: 8, marginRight: 0 },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        color: theme.palette.text.secondary,
        transition: `background-color ${motion.fast} ${motion.easing}, color ${motion.fast} ${motion.easing}`,
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main },
      }),
      sizeSmall: { padding: 8 },
    },
  },

  MuiLink: {
    defaultProps: { underline: 'hover' },
    styleOverrides: {
      root: ({ theme }) => ({ color: theme.palette.primary.main, fontWeight: 500 }),
    },
  },

  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: { backgroundImage: 'none' },
      rounded: { borderRadius: radius.xl },
      outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
    },
  },

  MuiCard: {
    defaultProps: { elevation: 0, variant: 'outlined' },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.xl,
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 1px 2px rgba(0,0,0,0.4)'
            : '0 1px 2px rgba(15,23,42,0.04)',
      }),
    },
  },

  MuiCardContent: {
    styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } },
  },

  MuiCardHeader: {
    styleOverrides: {
      root: { padding: '20px 24px' },
      title: { fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: '1rem' },
      subheader: { fontSize: '0.8125rem', marginTop: 2 },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        backgroundColor: theme.palette.background.paper,
        minHeight: touchTarget,
        fontSize: '0.9375rem',
        transition: `box-shadow ${motion.fast} ${motion.easing}, border-color ${motion.fast} ${motion.easing}`,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: alpha(theme.palette.text.primary, 0.24),
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.main,
          borderWidth: 1,
        },
        '&.Mui-focused': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`,
        },
        '&.Mui-error.Mui-focused': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.16)}`,
        },
        '&.Mui-disabled': { backgroundColor: alpha(theme.palette.text.primary, 0.02) },
      }),
      input: { padding: '10px 14px' },
      sizeSmall: {
        '& .MuiOutlinedInput-input': { padding: '8px 12px' },
      },
      multiline: { padding: 0 },
    },
  },

  MuiInputLabel: {
    styleOverrides: {
      root: { fontSize: '0.9375rem', overflow: 'visible', textOverflow: 'clip' },
      shrink: { fontWeight: 600 },
    },
  },

  MuiFormHelperText: {
    styleOverrides: { root: { marginLeft: 2, fontSize: '0.75rem', lineHeight: 1.5 } },
  },

  MuiFormControl: {
    styleOverrides: { root: { width: '100%' } },
  },

  MuiFormLabel: {
    styleOverrides: { root: { fontWeight: 500 } },
  },

  MuiSelect: {
    styleOverrides: { select: { minHeight: 'unset', display: 'flex', alignItems: 'center' } },
  },

  MuiMenu: {
    defaultProps: { transitionDuration: 150 },
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 12px 40px rgba(0,0,0,0.55)'
            : '0 12px 32px rgba(15,23,42,0.12)',
        marginTop: 6,
        minWidth: 180,
      }),
      list: { padding: 6 },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.sm,
        minHeight: 40,
        fontSize: '0.875rem',
        gap: 4,
        '&.Mui-selected': {
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main,
          fontWeight: 600,
        },
      }),
    },
  },

  MuiTooltip: {
    defaultProps: { arrow: true, enterDelay: 400 },
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? '#1E293B' : '#1A2332',
        color: '#F8FAFC',
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '7px 10px',
        borderRadius: radius.sm,
        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : 'none',
      }),
      arrow: ({ theme }) => ({
        color: theme.palette.mode === 'dark' ? '#1E293B' : '#1A2332',
      }),
    },
  },

  MuiChip: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.sm,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 26,
        transition: `background-color ${motion.fast} ${motion.easing}`,
      }),
      sizeSmall: {
        height: 22,
        fontSize: '0.6875rem',
        borderRadius: radius.xs,
        '& .MuiChip-label': { paddingInline: 8 },
      },
      label: { paddingInline: 10 },
      outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
      icon: { marginLeft: 8, marginRight: -2, fontSize: '0.9375rem' },
    },
  },

  MuiDivider: {
    styleOverrides: { root: { borderColor: 'inherit' } },
  },

  MuiTableContainer: {
    styleOverrides: { root: { borderRadius: radius.lg } },
  },

  MuiTable: {
    defaultProps: { size: 'small' },
  },

  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiTableCell-root': {
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
        padding: '12px 16px',
        fontSize: '0.875rem',
      }),
      head: ({ theme }) => ({
        fontWeight: 600,
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: theme.palette.text.secondary,
        whiteSpace: 'nowrap',
      }),
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        transition: `background-color ${motion.fast} ${motion.easing}`,
        '&.MuiTableRow-hover:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
      }),
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: radius.lg, fontSize: '0.875rem', padding: '12px 16px', alignItems: 'flex-start' },
      icon: { marginTop: 2, fontSize: '1.25rem' },
      message: { padding: '1px 0' },
      standard: ({ theme }) => ({
        '&.MuiAlert-colorSuccess': {
          backgroundColor: alpha(theme.palette.success.main, 0.08),
          color: theme.palette.success.main,
          border: `1px solid ${alpha(theme.palette.success.main, 0.26)}`,
        },
        '&.MuiAlert-colorError': {
          backgroundColor: alpha(theme.palette.error.main, 0.08),
          color: theme.palette.error.main,
          border: `1px solid ${alpha(theme.palette.error.main, 0.26)}`,
        },
        '&.MuiAlert-colorWarning': {
          backgroundColor: alpha(theme.palette.warning.main, 0.1),
          color: theme.palette.warning.main,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
        },
        '&.MuiAlert-colorInfo': {
          backgroundColor: alpha(theme.palette.info.main, 0.08),
          color: theme.palette.info.main,
          border: `1px solid ${alpha(theme.palette.info.main, 0.26)}`,
        },
      }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.xxl,
        backgroundImage: 'none',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 24px 80px rgba(0,0,0,0.6)'
            : '0 24px 64px rgba(15,23,42,0.18)',
      }),
    },
  },

  MuiDialogTitle: {
    styleOverrides: {
      root: { fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '1.25rem', padding: '22px 24px 12px' },
    },
  },

  MuiDialogContent: {
    styleOverrides: { root: { padding: '8px 24px 4px' } },
  },

  MuiDialogActions: {
    styleOverrides: { root: { padding: '16px 24px 22px', gap: 8 } },
  },

  MuiBackdrop: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.mode === 'dark' ? '#020617' : '#0F172A', 0.55),
        backdropFilter: 'blur(2px)',
      }),
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: ({ theme }) => ({ minHeight: 44, borderBottom: `1px solid ${theme.palette.divider}` }),
      indicator: ({ theme }) => ({ height: 3, borderRadius: '3px 3px 0 0', backgroundColor: theme.palette.primary.main }),
    },
  },

  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
        minHeight: 44,
        paddingInline: 16,
        color: theme.palette.text.secondary,
        '&.Mui-selected': { color: theme.palette.primary.main },
      }),
    },
  },

  MuiAvatar: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontFamily: '"Outfit", sans-serif',
        fontWeight: 700,
        backgroundColor: alpha(theme.palette.primary.main, 0.12),
        color: theme.palette.primary.main,
      }),
    },
  },

  MuiSkeleton: {
    defaultProps: { animation: 'wave' },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radius.md,
        backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.07),
      }),
      text: { borderRadius: radius.xs },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: alpha(theme.palette.primary.main, 0.12),
      }),
      bar: { borderRadius: radius.pill },
    },
  },

  MuiCircularProgress: {
    defaultProps: { thickness: 4 },
  },

  MuiPagination: {
    defaultProps: { shape: 'rounded', color: 'primary' },
    styleOverrides: {
      ul: { gap: 4 },
    },
  },

  MuiPaginationItem: {
    styleOverrides: {
      root: { borderRadius: radius.sm, fontWeight: 600, minWidth: 36, height: 36 },
    },
  },

  MuiAccordion: {
    defaultProps: { elevation: 0, disableGutters: true },
    styleOverrides: {
      root: ({ theme }) => ({
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${radius.lg}px !important`,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }),
    },
  },

  MuiSwitch: {
    styleOverrides: {
      root: { padding: 8 },
    },
  },

  MuiAutocomplete: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: radius.lg,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 12px 40px rgba(0,0,0,0.55)'
            : '0 12px 32px rgba(15,23,42,0.12)',
      }),
      option: { borderRadius: radius.sm, fontSize: '0.875rem', margin: '2px 6px', minHeight: 40 },
      inputRoot: { paddingTop: '4px !important', paddingBottom: '4px !important' },
    },
  },

  MuiBadge: {
    styleOverrides: {
      badge: { fontWeight: 700, fontSize: '0.6875rem' },
    },
  },

  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit' },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        backgroundImage: 'none',
      }),
    },
  },

  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
      }),
    },
  },

  MuiListItemButton: {
    styleOverrides: {
      root: { borderRadius: radius.md, minHeight: 44 },
    },
  },

  MuiToolbar: {
    styleOverrides: {
      root: { minHeight: 64 },
      gutters: { paddingInline: 16 },
    },
  },

  MuiTypography: {
    styleOverrides: {
      gutterBottom: { marginBottom: '0.5em' },
    },
  },

  MuiToggleButton: {
    styleOverrides: {
      root: { borderRadius: radius.md, textTransform: 'none', fontWeight: 600 },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Fábrica                                                                   */
/* -------------------------------------------------------------------------- */

/** Exporta o tema do modo indicado (já com escala tipográfica responsiva). */
export function getTheme(mode: 'light' | 'dark') {
  const base = createTheme({
    palette: mode === 'dark' ? darkPalette : lightPalette,
    typography,
    shape: {
      /**
       * Unidade base de raio para valores numéricos em `sx`.
       * MUI multiplica `borderRadius: n` (sx) por `theme.shape.borderRadius`;
       * com 4, `borderRadius: 2` = 8px, `3` = 12px, `4` = 16px — a escala usada
       * nas páginas. Raios "semânticos" vivem em `theme/tokens.ts` (`radius`).
       */
      borderRadius: 4,
    },
    spacing: 8,
    components,
    breakpoints: {
      values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
    },
  });

  // Títulos escalam para baixo em telas pequenas sem `sx` por página.
  return responsiveFontSizes(base, { factor: 2.1, breakpoints: ['sm', 'md'] });
}

/** Tema claro — mantido para imports antigos (`import theme from '../theme'`). */
const hospedaRNTheme = getTheme('light');

export default hospedaRNTheme;
