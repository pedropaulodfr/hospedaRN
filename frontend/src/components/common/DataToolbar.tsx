import type { ReactNode } from 'react';
import { Box, InputAdornment, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Search } from '@mui/icons-material';

type Sx = SxProps<Theme>;

/**
 * Barra de ferramentas de listagem: busca, filtros e ações.
 * Empilha no mobile e alinha em linha no desktop — sem espremer controles.
 */
export function DataToolbar({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: Sx;
}) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2.5,
          flexWrap: 'wrap',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Grupo esquerdo da toolbar: busca + filtros (cresce e quebra linha). */
export function DataToolbarGroup({ children, sx }: { children: ReactNode; sx?: Sx }) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: 1,
          minWidth: 0,
          flexWrap: 'wrap',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** Campo de busca padronizado (ícone, limpar via `value` controlado). */
export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  width = 320,
  size = 'small',
  inputProps,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  size?: 'small' | 'medium';
  inputProps?: Record<string, unknown>;
}) {
  return (
    <TextField
      size={size}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ fontSize: 20, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        },
        htmlInput: { 'aria-label': placeholder, ...inputProps },
      }}
      sx={{ width: { xs: '100%', sm: width }, maxWidth: '100%' }}
    />
  );
}
