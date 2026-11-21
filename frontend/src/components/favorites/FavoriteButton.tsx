import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, IconButton, Tooltip, alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Favorite, FavoriteBorder } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuthStore } from '../../stores/authStore';

type Sx = SxProps<Theme>;

/**
 * Botão de favoritar uma hospedagem.
 *
 * - Hóspede logado: alterna o favorito (estado otimista + reconciliação com o servidor).
 * - Visitante: abre o login preservando a rota de volta.
 * - Estabelecimento/administrador: não renderiza (não têm lista pessoal).
 *
 * `variant="icon"` fica sobre a foto do card; `variant="labeled"` vai no
 * cabeçalho da página de detalhe.
 */
export function FavoriteButton({
  estabelecimentoId,
  nome,
  variant = 'icon',
  size = 'medium',
  sx,
}: {
  estabelecimentoId: string;
  nome?: string;
  variant?: 'icon' | 'labeled';
  size?: 'small' | 'medium';
  sx?: Sx;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { canFavorite, isFavorite, toggleFavorite, isToggling } = useFavorites();

  // Estado otimista local: responde na hora; é descartado assim que a lista
  // vinda do servidor concorda com ele.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const doServidor = isFavorite(estabelecimentoId);

  useEffect(() => {
    if (optimistic !== null && doServidor === optimistic) setOptimistic(null);
  }, [doServidor, optimistic]);

  const favorited = optimistic ?? doServidor;
  const alvo = nome ?? 'esta hospedagem';
  const rotulo = favorited ? `Remover ${alvo} dos favoritos` : `Adicionar ${alvo} aos favoritos`;

  // Estabelecimento e admin não favoritam: esconder evita ação sem efeito.
  if (isAuthenticated && user?.role && user.role !== 'GUEST') return null;

  const exigirLogin = () => {
    toast('Entre como hóspede para salvar favoritos.');
    navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
  };

  const alternar = async () => {
    if (!canFavorite) {
      exigirLogin();
      return;
    }
    setOptimistic(!favorited);
    try {
      const favoritedFinal = await toggleFavorite(estabelecimentoId);
      setOptimistic(favoritedFinal);
      toast.success(favoritedFinal ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    } catch (err: any) {
      setOptimistic(null);
      if (err?.response?.status === 401) {
        exigirLogin();
      } else {
        toast.error(err?.response?.data?.message || 'Não foi possível atualizar seus favoritos.');
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Os cards da home/busca são clicáveis: o coração não pode navegar junto.
    e.preventDefault();
    e.stopPropagation();
    void alternar();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const cheio = (fontSize: number) => (
    <Favorite sx={{ fontSize, color: favorited ? 'secondary.main' : undefined }} />
  );
  const vazio = (fontSize: number) => <FavoriteBorder sx={{ fontSize }} />;

  if (variant === 'labeled') {
    return (
      <Button
        variant="outlined"
        size={size}
        aria-pressed={favorited}
        aria-label={rotulo}
        disabled={isToggling}
        onClick={handleClick}
        startIcon={favorited ? cheio(18) : vazio(18)}
        sx={[
          { color: favorited ? 'secondary.main' : 'text.primary' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {favorited ? 'Favoritado' : 'Favoritar'}
      </Button>
    );
  }

  return (
    <Tooltip title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
      <IconButton
        aria-pressed={favorited}
        aria-label={rotulo}
        disabled={isToggling}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        size={size}
        sx={[
          (t) => ({
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            bgcolor: alpha(t.palette.background.paper, 0.94),
            color: favorited ? t.palette.secondary.main : t.palette.text.secondary,
            border: `1px solid ${t.palette.divider}`,
            boxShadow: `0 2px 10px ${alpha(t.palette.common.black, 0.12)}`,
            '&:hover': {
              bgcolor: t.palette.background.paper,
              color: favorited ? t.palette.secondary.main : t.palette.text.primary,
            },
            '&.Mui-disabled': { color: t.palette.secondary.main, opacity: 0.6 },
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {favorited ? cheio(20) : vazio(20)}
      </IconButton>
    </Tooltip>
  );
}
