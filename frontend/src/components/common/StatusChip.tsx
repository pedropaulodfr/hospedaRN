import { Box, Chip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { statusMeta, modoPagamentoMeta } from '../../theme/tokens';
import type { StatusMeta } from '../../theme/tokens';
import { toneBorder, toneColor, toneSurface } from './tone';

type Sx = SxProps<Theme>;

/** 'AGUARDANDO_PAGAMENTO' → 'Aguardando pagamento' */
function humanize(status: string): string {
  const words = status.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function resolveMeta(status: string, map: Record<string, StatusMeta>): StatusMeta {
  const key = status?.toUpperCase?.() ?? '';
  return map[key] ?? { label: humanize(status || '—'), tone: 'neutral' };
}

const dot = (color: string, size = 7) => (
  <Box
    component="span"
    sx={{ width: size, height: size, borderRadius: '50%', bgcolor: color, display: 'block' }}
  />
);

/**
 * Selo de status do domínio.
 *
 * Nunca usa cor como único indicador: sempre mostra ponto + rótulo textual.
 * Status desconhecido cai em neutro com nome humanizado — nada quebra.
 */
export function StatusChip({
  status,
  size = 'small',
  label,
  sx,
}: {
  status: string;
  size?: 'small' | 'medium';
  label?: string;
  sx?: Sx;
}) {
  const meta = resolveMeta(status, statusMeta);

  return (
    <Chip
      size={size}
      label={label ?? meta.label}
      icon={dot('currentColor', size === 'small' ? 7 : 8)}
      sx={[
        (theme) => ({
          bgcolor: toneSurface(theme, meta.tone),
          color: toneColor(theme, meta.tone),
          border: '1px solid',
          borderColor: toneBorder(theme, meta.tone),
          fontWeight: 600,
          height: size === 'small' ? 26 : 32,
          '& .MuiChip-icon': { color: 'currentColor', marginLeft: 1.25, marginRight: -0.25 },
          '& .MuiChip-label': { paddingInline: 1 },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

/** Selo do modo de pagamento congelado na reserva (`PADRAO` | `MERCADO_PAGO`). */
export function ModoPagamentoChip({
  modo,
  size = 'small',
}: {
  modo?: string | null;
  size?: 'small' | 'medium';
}) {
  if (!modo) return null;
  const meta = resolveMeta(modo, modoPagamentoMeta);
  return <StatusChip status="__modo" label={meta.label} size={size} sx={(theme) => ({ color: toneColor(theme, meta.tone), bgcolor: toneSurface(theme, meta.tone), borderColor: toneBorder(theme, meta.tone) })} />;
}

/** Ponto de status isolado (para listas compactas e legendas). */
export function StatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const meta = resolveMeta(status, statusMeta);
  return (
    <Box
      component="span"
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: toneColor(theme, meta.tone),
        display: 'inline-block',
        flexShrink: 0,
      })}
    />
  );
}
