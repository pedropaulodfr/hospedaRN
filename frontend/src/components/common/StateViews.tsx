import type { ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { SearchOff, Refresh, ErrorOutlined, InboxOutlined } from '@mui/icons-material';

type Sx = SxProps<Theme>;

/**
 * Estado vazio — toda lista/tela precisa de um.
 * Diferente de erro: "não há dados" ≠ "falhou ao carregar".
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  sx,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 3,
          py: compact ? 4 : 8,
          gap: 1,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          width: compact ? 48 : 60,
          height: compact ? 48 : 60,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          mb: 1,
          '& svg': { fontSize: compact ? 24 : 30 },
        }}
      >
        {icon ?? <InboxOutlined />}
      </Box>
      <Typography variant={compact ? 'subtitle1' : 'h6'} component="p" color="textPrimary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}

/** Estado de erro com ação de recuperação explícita. */
export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  onRetry,
  retryLabel = 'Tentar novamente',
  compact = false,
  sx,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  sx?: Sx;
}) {
  return (
    <Box
      role="alert"
      sx={[
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          px: 3,
          py: compact ? 4 : 8,
          gap: 1,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: (t) => `${t.palette.error.main}14`,
          color: 'error.main',
          mb: 1,
          '& svg': { fontSize: 28 },
        }}
      >
        <ErrorOutlined />
      </Box>
      <Typography variant="h6" component="p">
        {title}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 440 }}>
        {description ?? 'Ocorreu uma falha na comunicação. Verifique sua conexão e tente de novo.'}
      </Typography>
      {onRetry && (
        <Button variant="outlined" startIcon={<Refresh />} onClick={onRetry} sx={{ mt: 1.5 }}>
          {retryLabel}
        </Button>
      )}
    </Box>
  );
}

/** Carregamento de página inteira, com rótulo para leitores de tela. */
export function PageLoading({ label = 'Carregando…', minHeight = '50vh' }: { label?: string; minHeight?: string | number }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight, gap: 2 }}
    >
      <CircularProgress size={36} />
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
    </Box>
  );
}

/** Carregamento inline compacto (dentro de botões, cards, listas). */
export function InlineLoading({ label, sx }: { label?: string; sx?: Sx }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={[{ alignItems: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]}
      role="status"
      aria-live="polite"
    >
      <CircularProgress size={18} />
      {label && (
        <Typography variant="body2" color="textSecondary">
          {label}
        </Typography>
      )}
    </Stack>
  );
}

/** Esqueleto de tabela/listagem — reserva espaço e evita salto de layout. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', gap: 2, px: 2, py: 1.5, bgcolor: 'action.hover', borderRadius: 2, mb: 1 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" height={18} sx={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, r) => (
        <Box key={r} sx={{ display: 'flex', gap: 2, px: 2, py: 2 }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} variant="text" height={22} sx={{ flex: c === 0 ? 2 : 1 }} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/** Esqueleto em grade para cards (listagens visuais). */
export function CardGridSkeleton({ count = 6, height = 260 }: { count?: number; height?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} />
      ))}
    </Box>
  );
}

/** Erro de formulário em faixa, acima das ações. */
export function FormError({ message }: { message?: ReactNode }) {
  if (!message) return null;
  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}

/** Ícone padrão de busca vazia para reuso em listagens filtradas. */
export const EmptySearchIcon = <SearchOff />;
