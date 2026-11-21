import type { ReactNode } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Tone } from '../../theme/tokens';
import { toneColor, toneSurface } from './tone';

type Sx = SxProps<Theme>;

/**
 * Cartão de indicador (KPI) para dashboards.
 *
 * `tone` define a cor do ícone/superfície; o valor é tipograficamente dominante
 * para leitura rápida em varredura.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  trend,
  loading = false,
  onClick,
  sx,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  loading?: boolean;
  onClick?: () => void;
  sx?: Sx;
}) {
  return (
    <Box
      onClick={onClick}
      sx={[
        (theme) => ({
          p: 2.5,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          height: '100%',
          transition: 'border-color 180ms, box-shadow 180ms',
          ...(onClick && {
            cursor: 'pointer',
            '&:hover': {
              borderColor: toneColor(theme, tone),
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 6px 20px rgba(0,0,0,0.4)'
                  : '0 6px 20px rgba(15,23,42,0.08)',
            },
          }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {label}
        </Typography>
        {icon && (
          <Box
            sx={(theme) => ({
              width: 38,
              height: 38,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: toneSurface(theme, tone),
              color: toneColor(theme, tone),
              '& svg': { fontSize: 20 },
            })}
          >
            {icon}
          </Box>
        )}
      </Box>

      {loading ? (
        <Skeleton variant="text" width="55%" height={38} />
      ) : (
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', wordBreak: 'break-word' }}
        >
          {value}
        </Typography>
      )}

      {(hint || trend) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {trend && (
            <Typography
              variant="caption"
              sx={(theme) => ({
                fontWeight: 700,
                color:
                  trend.direction === 'up'
                    ? theme.palette.success.main
                    : trend.direction === 'down'
                      ? theme.palette.error.main
                      : theme.palette.text.secondary,
              })}
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}
            </Typography>
          )}
          {hint && (
            <Typography variant="caption" color="textSecondary">
              {hint}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
