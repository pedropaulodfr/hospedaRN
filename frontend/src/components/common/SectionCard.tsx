import type { ReactNode } from 'react';
import { Box, Card, Divider, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type Sx = SxProps<Theme>;

/**
 * Card de seção com cabeçalho opcional e ação alinhada à direita.
 *
 * Substitui o padrão `Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid' }}`
 * espalhado pelo código, e concentra o ritmo de espaçamento (20/24px).
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  contentSx,
  noPadding = false,
  sx,
  headerDivider = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  contentSx?: Sx;
  noPadding?: boolean;
  sx?: Sx;
  headerDivider?: boolean;
}) {
  const hasHeader = Boolean(title || action);

  return (
    <Card
      sx={[
        { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {hasHeader && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 2,
              px: 3,
              py: 2.5,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {typeof title === 'string' ? (
                <Typography variant="h6" component="h2" color="textPrimary">
                  {title}
                </Typography>
              ) : (
                title
              )}
              {subtitle && (
                <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {action}
              </Box>
            )}
          </Box>
          {headerDivider && <Divider />}
        </>
      )}

      <Box
        sx={[
          { flex: 1, p: noPadding ? 0 : 3 },
          ...(Array.isArray(contentSx) ? contentSx : [contentSx]),
        ]}
      >
        {children}
      </Box>
    </Card>
  );
}
