import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Box,
  Typography,
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';

/**
 * Diálogo de confirmação para ações destrutivas ou irreversíveis.
 * Padroniza título, mensagem, rótulos e estado `loading` do botão de ação.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading = false,
  onConfirm,
  onClose,
  icon,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'error' | 'secondary';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const isDestructive = tone === 'error';

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {(icon ?? isDestructive) && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: isDestructive ? 'error.main' : 'primary.main',
              color: isDestructive ? 'error.contrastText' : 'primary.contrastText',
              '& svg': { fontSize: 20 },
            }}
          >
            {icon ?? <WarningAmber />}
          </Box>
        )}
        <Typography variant="h6" component="span" sx={{ fontFamily: '"Outfit", sans-serif' }}>
          {title}
        </Typography>
      </DialogTitle>

      {(description || children) && (
        <DialogContent>
          {description && (
            <DialogContentText component="div" sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
              {description}
            </DialogContentText>
          )}
          {children}
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={onClose} disabled={loading} color="inherit">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={tone} disabled={loading}>
          {loading ? 'Aguarde…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
