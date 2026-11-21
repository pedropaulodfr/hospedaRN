import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Favorite,
  FavoriteBorder,
  Star,
  Place,
  ArrowForward,
  Hotel,
  Refresh,
} from '@mui/icons-material';
import {
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  MediaFallback,
} from '../../components/common';
import { favoritesApi } from '../../services/api';
import { FAVORITES_KEY } from '../../hooks/useFavorites';
import toast from 'react-hot-toast';

interface FavoriteItem {
  id: string;
  estabelecimentoId: string;
  criadoEm: string;
  estabelecimento: {
    id: string;
    nome: string;
    descricao?: string;
    endereco?: string;
    fotoPerfil?: string;
    notaMedia?: number | string;
    totalAvaliacoes?: number;
    cidade: {
      id: string;
      nome: string;
      estado: string;
    };
  };
}

export default function GuestFavorites() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await favoritesApi.getAll();
      setFavorites(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleRemove = async (fav: FavoriteItem) => {
    setRemovingId(fav.id);
    try {
      await favoritesApi.toggle(fav.estabelecimentoId);
      setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
      // Mantém os corações das outras telas em sincronia com esta remoção.
      void queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
      toast.success('Removido dos favoritos');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover favorito');
    } finally {
      setRemovingId(null);
    }
  };

  const countLabel =
    favorites.length === 1
      ? '1 estabelecimento salvo'
      : `${favorites.length} estabelecimentos salvos`;

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        icon={<FavoriteBorder />}
        overline="Área do hóspede"
        title="Meus favoritos"
        subtitle={
          loading || error
            ? 'Suas hospedagens preferidas para reservar depois.'
            : `${countLabel} para reservar depois.`
        }
        actions={
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadFavorites}
            disabled={loading}
          >
            Atualizar
          </Button>
        }
      />

      {loading ? (
        <CardGridSkeleton count={6} height={292} />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar seus favoritos"
          description="Verifique sua conexão e tente novamente."
          onRetry={loadFavorites}
        />
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={<FavoriteBorder />}
          title="Nenhum favorito ainda"
          description="Salve os estabelecimentos que você gostou para encontrá-los rapidamente quando quiser reservar."
          action={
            <Button
              variant="contained"
              startIcon={<Hotel />}
              onClick={() => navigate('/busca')}
            >
              Explorar hospedagens
            </Button>
          }
        />
      ) : (
        <Grid container spacing={3}>
          {favorites.map((fav) => {
            const est = fav.estabelecimento;
            const removendo = removingId === fav.id;
            const nota = Number(est.notaMedia) || 0;

            return (
              <Grid key={fav.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'border-color 180ms, box-shadow 180ms',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2,
                    },
                  }}
                >
                  <Box
                    sx={(t) => ({
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 9',
                      flexShrink: 0,
                      background: est.fotoPerfil
                        ? undefined
                        : `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.9)} 0%, ${alpha(
                            t.palette.secondary.main,
                            0.78,
                          )} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.contrastText',
                    })}
                  >
                    {est.fotoPerfil ? (
                      <Box
                        component="img"
                        src={est.fotoPerfil}
                        alt={`Foto de ${est.nome}`}
                        loading="lazy"
                        onClick={() => navigate(`/hospedagem/${est.id}`)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          cursor: 'pointer',
                        }}
                      />
                    ) : (
                      <MediaFallback variant="establishment" label={est.nome} />
                    )}

                    <Chip
                      size="small"
                      icon={<Place sx={{ fontSize: 14 }} />}
                      label={`${est.cidade.nome}, ${est.cidade.estado}`}
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        maxWidth: 'calc(100% - 64px)',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        backdropFilter: 'blur(6px)',
                        '& .MuiChip-icon': { color: 'primary.main' },
                      }}
                    />

                    <Tooltip title="Remover dos favoritos">
                      <IconButton
                        size="small"
                        onClick={() => handleRemove(fav)}
                        disabled={removendo}
                        aria-label={`Remover ${est.nome} dos favoritos`}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          color: 'error.main',
                          '&:hover': { bgcolor: 'background.paper', color: 'error.dark' },
                        }}
                      >
                        {removendo ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <Favorite fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Typography
                      variant="subtitle1"
                      component="h2"
                      sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
                    >
                      {est.nome}
                    </Typography>

                    {est.descricao && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: nota > 0 ? 1.5 : 0,
                        }}
                      >
                        {est.descricao}
                      </Typography>
                    )}

                    {nota > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Star aria-hidden sx={{ fontSize: 16, color: 'warning.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {nota.toFixed(1)}
                        </Typography>
                        {est.totalAvaliacoes !== undefined && (
                          <Typography variant="caption" color="textSecondary">
                            ({est.totalAvaliacoes} avaliaç
                            {est.totalAvaliacoes === 1 ? 'ão' : 'ões'})
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      endIcon={<ArrowForward />}
                      onClick={() => navigate(`/hospedagem/${est.id}`)}
                    >
                      Ver detalhes
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </PageContainer>
  );
}
