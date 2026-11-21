import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { BeachAccess } from '@mui/icons-material';
import { brandGradient, brandTextGradient, darkSurface } from '../../theme/tokens';

/**
 * Símbolo do HospedaRN — réplica exata da identidade original:
 * quadrado de 36px com raio de 10px, `linear-gradient(135deg, #0097A7, #FF7043)`
 * e o guarda-sol (BeachAccess) branco de 20px. As proporções acompanham `size`.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: `${(size * 10) / 36}px`,
        background: brandGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <BeachAccess sx={{ color: 'white', fontSize: (size * 20) / 36 }} />
    </Box>
  );
}

/**
 * Assinatura completa da marca (símbolo + "HospedaRN"), replicando o original:
 * gap de 8px, Outfit 800, `letter-spacing: -0.02em` e gradiente da marca no texto.
 * Sobre superfícies escuras (`onDark`) usa branco + acento para manter contraste.
 */
export function Logo({
  size = 36,
  showWordmark = true,
  to = '/',
  onClick,
  onDark = false,
  onDarkFill = 'surface',
}: {
  size?: number;
  showWordmark?: boolean;
  to?: string;
  onClick?: () => void;
  onDark?: boolean;
  /** Em `onDark`, `surface` = rodapé/faixa escura do site; `brand` = painel teal. */
  onDarkFill?: 'surface' | 'brand';
}) {
  return (
    <Box
      component={RouterLink}
      to={to}
      onClick={onClick}
      aria-label="HospedaRN — página inicial"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        textDecoration: 'none',
        color: onDark ? (onDarkFill === 'brand' ? 'common.white' : darkSurface.text) : 'text.primary',
        '&:hover': { opacity: 0.92 },
      }}
    >
      <LogoMark size={size} />
      {showWordmark && (
        <Typography
          component="span"
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 800,
            fontSize: size <= 30 ? '1.0625rem' : '1.25rem',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            ...(onDark
              ? { color: 'inherit' }
              : {
                  background: brandTextGradient,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }),
          }}
        >
          Hospeda
          <Box component="span" sx={onDark ? { color: darkSurface.accent } : undefined}>
            RN
          </Box>
        </Typography>
      )}
    </Box>
  );
}
