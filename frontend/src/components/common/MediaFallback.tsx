import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

type Sx = SxProps<Theme>;

/**
 * Fallback visual para imagens ausentes (cidade ou estabelecimento sem foto).
 *
 * Em vez de um ícone solto ou de um gerador externo de placeholder, usa uma
 * superfície da própria marca: gradiente teal da paleta + ondas discretas.
 *
 * - `variant="city"`: mostra o nome da cidade em destaque (o card não repete o nome).
 * - `variant="establishment"`: mostra o monograma do estabelecimento, porque o
 *   nome já aparece no título do card.
 */
export function MediaFallback({
  variant = 'establishment',
  label,
  size = 'md',
  sx,
}: {
  variant?: 'city' | 'establishment';
  label?: string;
  /** Escala do monograma — `lg` para áreas grandes (galeria), `sm` para listas. */
  size?: 'sm' | 'md' | 'lg';
  sx?: Sx;
}) {
  const isCity = variant === 'city';
  const monogram = (label || '').trim().charAt(0).toUpperCase();
  const circle = size === 'lg' ? 104 : size === 'sm' ? 44 : 64;
  const glyph = size === 'lg' ? '2.5rem' : size === 'sm' ? '1.125rem' : '1.625rem';

  return (
    <Box
      role="img"
      aria-label={label ? `Sem foto disponível de ${label}` : 'Sem foto disponível'}
      sx={[
        (theme) => ({
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 96,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isCity
            ? `linear-gradient(140deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.light} 130%)`
            : `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(
                theme.palette.primary.main,
                0.05,
              )} 60%, ${alpha(theme.palette.secondary.main, 0.07)} 100%)`,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Ondas decorativas — eco da marca, sem competir com o conteúdo. */}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          color: isCity ? theme.palette.common.white : theme.palette.primary.main,
          opacity: isCity ? 0.13 : 0.06,
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160" preserveAspectRatio="none">' +
              '<path d="M0 120c50-24 100-24 150 0s100 24 150 0 100-24 150 0v40H0z" fill="currentColor"/>' +
              '<path d="M0 92c50-22 100-22 150 0s100 22 150 0 100-22 150 0v30H0z" fill="currentColor" opacity="0.55"/>' +
              '</svg>',
          )}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom',
          backgroundRepeat: 'no-repeat',
        })}
      />

      {isCity ? (
        label ? (
          <Box sx={{ position: 'relative', zIndex: 1, px: 2, textAlign: 'center' }}>
            <Box
              component="span"
              sx={(theme) => ({
                display: 'block',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.5rem', sm: '1.875rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: theme.palette.common.white,
                textShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.25)}`,
              })}
            >
              {label}
            </Box>
          </Box>
        ) : null
      ) : (
        <Box
          sx={(theme) => ({
            position: 'relative',
            zIndex: 1,
            width: circle,
            height: circle,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            color: theme.palette.primary.main,
          })}
        >
          <Box
            component="span"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 800,
              fontSize: glyph,
              lineHeight: 1,
              opacity: 0.85,
            }}
          >
            {monogram || <BuildingGlyph size={size} />}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Glifo simples de "hospedagem" quando não há nem nome para monograma. */
function BuildingGlyph({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }): ReactNode {
  const px = size === 'lg' ? 44 : size === 'sm' ? 20 : 26;
  return (
    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: px, height: px }}>
      <path
        d="M4 20V8.5L12 4l8 4.5V20h-5v-5h-6v5H4z"
        fill="currentColor"
        fillOpacity="0.85"
      />
    </Box>
  );
}
