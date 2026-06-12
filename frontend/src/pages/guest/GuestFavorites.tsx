import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Star,
  Place,
  ArrowForward,
  Hotel,
  Refresh,
  Home,
} from '@mui/icons-material';
import { favoritesApi } from '../../services/api';
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

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavorites = async () => {
    try {
      const res = await favoritesApi.getAll();
      setFavorites(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
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
      toast.success('Removido dos favoritos');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover favorito');
    } finally {
      setRemovingId(null);
    }
  };

  const getPhotoUrl = (est: FavoriteItem['estabelecimento']) =>
    est.fotoPerfil || 'https://placehold.co/400x250/0097A7/FFFFFF?text=HospedaRN';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Meus Favoritos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {favorites.length === 1
              ? '1 estabelecimento salvo'
              : `${favorites.length} estabelecimentos salvos`}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadFavorites}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
        >
          Atualizar
        </Button>
      </Box>

      {favorites.length === 0 ? (
        <Paper
          sx={{
            p: 8,
            borderRadius: '20px',
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <FavoriteBorder sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Nenhum favorito ainda
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Salve seus estabelecimentos preferidos para encontrá-los rapidamente quando quiser fazer uma reserva.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Hotel />}
            onClick={() => navigate('/busca')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            Explorar Hospedagens
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {favorites.map((fav) => (
            <Grid key={fav.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    height="160"
                    image={getPhotoUrl(fav.estabelecimento)}
                    alt={fav.estabelecimento.nome}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/hospedagem/${fav.estabelecimento.id}`)}
                  />
                  <Chip
                    label={`${fav.estabelecimento.cidade.nome}, ${fav.estabelecimento.cidade.estado}`}
                    icon={<Place sx={{ fontSize: '12px !important' }} />}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      bgcolor: 'rgba(0,0,0,0.65)',
                      color: 'white',
                      backdropFilter: 'blur(4px)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      '& .MuiChip-icon': { color: 'primary.light', fontSize: '12px' },
                    }}
                  />
                  <Tooltip title="Remover dos favoritos">
                    <IconButton
                      onClick={() => handleRemove(fav)}
                      disabled={removingId === fav.id}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(4px)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                      }}
                      size="small"
                    >
                      {removingId === fav.id ? (
                        <CircularProgress size={18} />
                      ) : (
                        <Favorite sx={{ fontSize: 20, color: '#EF4444' }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>

                <CardContent
                  sx={{
                    flexGrow: 1,
                    p: 2.5,
                    cursor: 'pointer',
                    '&:last-child': { pb: 1 },
                  }}
                  onClick={() => navigate(`/hospedagem/${fav.estabelecimento.id}`)}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {fav.estabelecimento.nome}
                  </Typography>

                  {fav.estabelecimento.descricao && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontSize: '0.8rem',
                      }}
                    >
                      {fav.estabelecimento.descricao}
                    </Typography>
                  )}

                  {fav.estabelecimento.notaMedia && Number(fav.estabelecimento.notaMedia) > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Star sx={{ fontSize: 16, color: '#F59E0B' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {Number(fav.estabelecimento.notaMedia).toFixed(1)}
                      </Typography>
                      {fav.estabelecimento.totalAvaliacoes !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          ({fav.estabelecimento.totalAvaliacoes} avaliaç{ fav.estabelecimento.totalAvaliacoes === 1 ? 'ão' : 'ões'})
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ px: 2.5, pb: 2, pt: 0 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate(`/hospedagem/${fav.estabelecimento.id}`)}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                    }}
                  >
                    Ver detalhes
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
