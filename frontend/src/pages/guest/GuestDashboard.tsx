import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
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
  Avatar,
  Chip,
} from '@mui/material';
import {
  Refresh,
  ArrowForward,
  Search,
  Favorite,
  Person,
  CalendarMonth,
  Hotel,
  CheckCircle,
  Schedule,
  EventAvailable,
  Place,
  Star,
  TrendingUp,
} from '@mui/icons-material';
import { reservationsApi, favoritesApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

dayjs.locale('pt-br');

interface Reservation {
  id: string;
  codigoReserva: string;
  checkIn: string;
  checkOut: string;
  adultos: number;
  criancas: number;
  valorTotal: number | string;
  status: 'SOLICITADA' | 'CONFIRMADA' | 'AGUARDANDO_PAGAMENTO' | 'FINALIZADA' | 'CANCELADA';
  estabelecimento: {
    id: string;
    nome: string;
    endereco?: string;
    cidade: { id: string; nome: string; estado: string };
    fotos: { id: string; url: string; isCapa: boolean }[];
  };
  quarto: { id: string; nome: string; capacidade: number };
  criadoEm: string;
}

interface FavoriteItem {
  id: string;
  estabelecimento: {
    id: string;
    nome: string;
    cidade: { nome: string; estado: string };
    notaMedia?: number | string;
  };
}

const statusChipConfig: Record<string, { label: string; color: 'info' | 'warning' | 'success' | 'error' }> = {
  SOLICITADA:           { label: 'Solicitada',           color: 'info' },
  CONFIRMADA:           { label: 'Confirmada',           color: 'warning' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguard. Pagamento',    color: 'warning' },
  FINALIZADA:           { label: 'Finalizada',           color: 'success' },
  CANCELADA:            { label: 'Cancelada',            color: 'error' },
};

export default function GuestDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reservRes, favRes] = await Promise.all([
        reservationsApi.getAll({ limit: 1000 }),
        favoritesApi.getAll(),
      ]);

      setReservations(reservRes.data?.data?.data || reservRes.data?.data || reservRes.data || []);
      setFavorites(favRes.data?.data || favRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | string) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

  const now = dayjs();

  const upcoming = reservations
    .filter((r) => r.status !== 'CANCELADA' && dayjs(r.checkIn).isAfter(now))
    .sort((a, b) => dayjs(a.checkIn).diff(dayjs(b.checkIn)));

  const recent = [...reservations]
    .sort((a, b) => dayjs(b.criadoEm).diff(dayjs(a.criadoEm)))
    .slice(0, 5);

  const nextReservation = upcoming[0];

  const totalReservations = reservations.length;
  const activeCount = reservations.filter(
    (r) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO',
  ).length;
  const finalizedCount = reservations.filter((r) => r.status === 'FINALIZADA').length;

  const getCapaUrl = (est: any) => {
    const capa = est?.fotos?.find((f: any) => f.isCapa);
    return capa?.url || est?.fotos?.[0]?.url || '';
  };

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
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Olá, {user?.nome?.split(' ')[0] || 'Hóspede'}!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadData}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
        >
          Atualizar
        </Button>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: 'rgba(0,151,167,0.15)', color: '#0097A7', width: 44, height: 44 }}>
              <CalendarMonth sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>Total de Reservas</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{totalReservations}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', width: 44, height: 44 }}>
              <Schedule sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>Ativas</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeCount}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981', width: 44, height: 44 }}>
              <CheckCircle sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>Finalizadas</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{finalizedCount}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#EF4444', width: 44, height: 44 }}>
              <Favorite sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>Favoritos</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{favorites.length}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Next Stay */}
        <Grid size={{ xs: 12, md: 5 }}>
          {nextReservation ? (
            <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', height: '100%', position: 'relative' }}>
              {getCapaUrl(nextReservation.estabelecimento) && (
                <Box
                  component="img"
                  src={getCapaUrl(nextReservation.estabelecimento)}
                  alt=""
                  sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                />
              )}
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <EventAvailable sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Próxima Estada
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {nextReservation.estabelecimento?.nome || 'Estabelecimento'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {nextReservation.quarto?.nome} · {nextReservation.estabelecimento?.cidade?.nome}, {nextReservation.estabelecimento?.cidade?.estado}
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Check-in</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(nextReservation.checkIn).format('DD/MM/YYYY')}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Check-out</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(nextReservation.checkOut).format('DD/MM/YYYY')}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatCurrency(nextReservation.valorTotal)}
                  </Typography>
                  <Chip
                    label={statusChipConfig[nextReservation.status]?.label || nextReservation.status}
                    size="small"
                    color={statusChipConfig[nextReservation.status]?.color || 'default'}
                    sx={{ borderRadius: '6px', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </Box>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                  onClick={() => navigate('/hospede/reservas')}
                >
                  Ver detalhes da reserva
                </Button>
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ p: 4, borderRadius: '20px', border: '1px dashed', borderColor: 'divider', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <Hotel sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Nenhuma estada futura</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Explore hospedagens e planeje sua próxima viagem.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={() => navigate('/busca')}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, background: 'linear-gradient(135deg, #0097A7, #00BCD4)' }}
              >
                Buscar Hospedagens
              </Button>
            </Paper>
          )}
        </Grid>

        {/* Recent Reservations */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
                Reservas Recentes
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/hospede/reservas')}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
              >
                Ver todas
              </Button>
            </Box>

            {recent.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Você ainda não possui reservas.</Typography>
              </Box>
            ) : (
              recent.map((res) => (
                <Box
                  key={res.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Avatar src={getCapaUrl(res.estabelecimento)} variant="rounded" sx={{ width: 44, height: 44 }}>
                    <Hotel />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {res.estabelecimento?.nome || 'Estabelecimento'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {res.quarto?.nome || 'Quarto'} · {dayjs(res.checkIn).format('DD/MM')} - {dayjs(res.checkOut).format('DD/MM')}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(res.valorTotal)}
                    </Typography>
                  </Box>
                  <Chip
                    label={statusChipConfig[res.status]?.label || res.status}
                    size="small"
                    color={statusChipConfig[res.status]?.color || 'default'}
                    sx={{ borderRadius: '6px', fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </Box>
              ))
            )}
          </Paper>
        </Grid>

        {/* Upcoming Stays */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
                Próximas Estadas
              </Typography>
              {upcoming.length > 3 && (
                <Button
                  size="small"
                  endIcon={<ArrowForward />}
                  onClick={() => navigate('/hospede/reservas')}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                >
                  Ver todas ({upcoming.length})
                </Button>
              )}
            </Box>

            {upcoming.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Nenhuma estada futura. Que tal planejar uma viagem?</Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {upcoming.slice(0, 3).map((res) => (
                  <Grid key={res.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
                      {getCapaUrl(res.estabelecimento) && (
                        <CardMedia component="img" height="120" image={getCapaUrl(res.estabelecimento)} alt={res.estabelecimento?.nome} />
                      )}
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {res.estabelecimento?.nome || 'Estabelecimento'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 1 }}>
                          <Place sx={{ fontSize: 14 }} />
                          {res.estabelecimento?.cidade?.nome}, {res.estabelecimento?.cidade?.estado}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(res.checkIn).format('DD/MM')} - {dayjs(res.checkOut).format('DD/MM')}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatCurrency(res.valorTotal)}
                          </Typography>
                        </Box>
                        <Chip
                          label={statusChipConfig[res.status]?.label || res.status}
                          size="small"
                          color={statusChipConfig[res.status]?.color || 'default'}
                          sx={{ borderRadius: '6px', fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
              Acesso Rápido
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: 'Buscar Hospedagens', icon: <Search />, path: '/busca', color: '#0097A7' },
                { label: 'Minhas Reservas', icon: <CalendarMonth />, path: '/hospede/reservas', color: '#FF7043' },
                { label: 'Favoritos', icon: <Favorite />, path: '/hospede/favoritos', color: '#F59E0B' },
                { label: 'Meu Perfil', icon: <Person />, path: '/hospede/perfil', color: '#10B981' },
              ].map((item) => (
                <Grid key={item.path} size={{ xs: 6, sm: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={item.icon}
                    onClick={() => navigate(item.path)}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: 'divider',
                      color: 'text.primary',
                      justifyContent: 'flex-start',
                      '&:hover': { borderColor: item.color, bgcolor: `${item.color}08` },
                    }}
                  >
                    {item.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Favorites */}
        {favorites.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
                  Meus Favoritos
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowForward />}
                  onClick={() => navigate('/hospede/favoritos')}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                >
                  Ver todos
                </Button>
              </Box>

              <Grid container spacing={2}>
                {favorites.slice(0, 4).map((fav) => (
                  <Grid key={fav.id} size={{ xs: 6, sm: 3 }}>
                    <Paper
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        height: '100%',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0,151,167,0.04)' },
                      }}
                      onClick={() => navigate(`/hospedagem/${fav.estabelecimento.id}`)}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {fav.estabelecimento.nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <Place sx={{ fontSize: 12 }} />
                        {fav.estabelecimento.cidade.nome}, {fav.estabelecimento.cidade.estado}
                      </Typography>
                      {fav.estabelecimento.notaMedia && Number(fav.estabelecimento.notaMedia) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5 }}>
                          <Star sx={{ fontSize: 14, color: '#F59E0B' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {Number(fav.estabelecimento.notaMedia).toFixed(1)}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
