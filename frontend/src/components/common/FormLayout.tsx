import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type Sx = SxProps<Theme>;

/**
 * Bloco de formulário com título, descrição e conteúdo.
 * Agrupa campos relacionados sem "cards dentro de cards".
 */
export function FormSection({
  title,
  description,
  children,
  sx,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  sx?: Sx;
}) {
  return (
    <Box
      component="section"
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 2 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {title && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
      )}
      {children}
    </Box>
  );
}

/**
 * Grade de campos com colunas responsivas e controle de `span`.
 * Usa CSS Grid (não MUI Grid) para manter alturas e espaçamentos previsíveis.
 */
export function FormGrid({
  children,
  columns = 2,
  gap = 2,
  sx,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  gap?: number;
  sx?: Sx;
}) {
  const templates = {
    1: { xs: '1fr' },
    2: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    3: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
  } as const;

  return (
    <Box
      sx={[
        { display: 'grid', gridTemplateColumns: templates[columns], gap, alignItems: 'start' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Campo que ocupa a linha inteira (ou N colunas) dentro de `FormGrid`. */
export function FormSpan({
  children,
  span = 2,
  sx,
}: {
  children: ReactNode;
  span?: number;
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        { gridColumn: { xs: '1 / -1', sm: `span ${span}` } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Linha de ações de formulário alinhada à direita, com quebra no mobile. */
export function FormActions({ children, sx }: { children: ReactNode; sx?: Sx }) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          mt: 3,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
