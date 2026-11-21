import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { Tone } from '../../theme/tokens';

/** Cor principal de um tom semântico, já ajustada para o modo claro/escuro. */
export function toneColor(theme: Theme, tone: Tone): string {
  if (tone === 'neutral') {
    return theme.palette.text.secondary;
  }
  return theme.palette[tone].main;
}

/** Superfície suave (fundo de ícone, chip, faixa) para um tom semântico. */
export function toneSurface(theme: Theme, tone: Tone): string {
  return alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.18 : 0.1);
}

/** Borda suave para um tom semântico. */
export function toneBorder(theme: Theme, tone: Tone): string {
  return alpha(toneColor(theme, tone), theme.palette.mode === 'dark' ? 0.34 : 0.22);
}
