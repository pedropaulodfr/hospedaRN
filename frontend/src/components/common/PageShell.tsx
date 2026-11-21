import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { containerWidth } from '../../theme/tokens';

type WidthKey = keyof typeof containerWidth;
type Sx = SxProps<Theme>;

/**
 * Container padrão de página.
 *
 * Substitui o par `Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}` repetido nas telas.
 * Aplica ritmo de espaçamento responsivo (16 → 24 → 32px) e largura máxima por intenção.
 */
export function PageContainer({
  children,
  maxWidth = 'content',
  sx,
  gutterTop = true,
}: {
  children: ReactNode;
  maxWidth?: WidthKey | number;
  sx?: Sx;
  gutterTop?: boolean;
}) {
  const width = typeof maxWidth === 'number' ? maxWidth : containerWidth[maxWidth];

  return (
    <Box
      sx={[
        {
          width: '100%',
          maxWidth: width,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          pt: gutterTop ? { xs: 2.5, md: 3.5 } : 0,
          pb: { xs: 4, md: 5 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/**
 * Cabeçalho de página: título (h1 semântico), subtítulo e ações.
 * Uma página = um `h1`. A hierarquia seguinte usa `SectionHeading`.
 */
export function PageHeader({
  title,
  subtitle,
  overline,
  actions,
  icon,
  sx,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  overline?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  sx?: Sx;
}) {
  return (
    <Box
      component="header"
      sx={[
        {
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 2, md: 3 },
          mb: { xs: 2.5, md: 3.5 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, minWidth: 0 }}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'action.selected',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          {overline && (
            <Typography
              variant="overline"
              color="primary"
              sx={{ display: 'block', mb: 0.25, lineHeight: 1.3 }}
            >
              {overline}
            </Typography>
          )}
          <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ mt: 0.75, maxWidth: 720 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>

      {actions && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
        >
          {actions}
        </Stack>
      )}
    </Box>
  );
}

/**
 * Cabeçalho de seção dentro de uma página (ex.: "Explore as cidades").
 * Usa `h2` para manter a hierarquia semântica abaixo do `h1` da página.
 */
export function SectionHeading({
  title,
  subtitle,
  overline,
  action,
  align = 'left',
  sx,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  overline?: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: align === 'center' ? 'center' : 'flex-start', sm: 'flex-end' },
          justifyContent: 'space-between',
          textAlign: align,
          gap: 2,
          mb: { xs: 3, md: 4 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ maxWidth: 640 }}>
        {overline && (
          <Typography
            variant="overline"
            color="primary"
            sx={{ display: 'block', mb: 0.5, lineHeight: 1.3 }}
          >
            {overline}
          </Typography>
        )}
        <Typography variant="h3" component="h2" sx={{ color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
}
