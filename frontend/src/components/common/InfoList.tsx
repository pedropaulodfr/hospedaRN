import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type Sx = SxProps<Theme>;

/**
 * Grade de informações rótulo/valor para telas de detalhe
 * (reserva, estabelecimento, quarto). Mantém leitura em duas colunas no desktop
 * e uma no mobile.
 */
export function InfoGrid({
  children,
  columns = 2,
  sx,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  sx?: Sx;
}) {
  const templates = {
    1: '1fr',
    2: 'repeat(2, minmax(0, 1fr))',
    3: 'repeat(3, minmax(0, 1fr))',
  } as const;

  return (
    <Box
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: templates[columns] },
          gap: 2,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Par rótulo + valor. `emphasis` destaca o valor (total, código, status). */
export function InfoItem({
  label,
  value,
  icon,
  emphasis = false,
  sx,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  emphasis?: boolean;
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}
      >
        {icon}
        {label}
      </Typography>
      <Typography
        variant={emphasis ? 'subtitle1' : 'body2'}
        component="div"
        sx={{
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? 'text.primary' : 'text.primary',
          wordBreak: 'break-word',
        }}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

/** Par rótulo/valor em linha — para tabelas de resumo e painéis laterais. */
export function InfoRow({
  label,
  value,
  emphasis = false,
  sx,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 2,
          py: 0.75,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography variant={emphasis ? 'subtitle1' : 'body2'} color={emphasis ? 'text.primary' : 'text.secondary'}>
        {label}
      </Typography>
      <Typography
        variant={emphasis ? 'h6' : 'body2'}
        component="div"
        sx={{ fontWeight: emphasis ? 700 : 600, color: 'text.primary', textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
