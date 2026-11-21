import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  CardMedia,
  Avatar,
  Divider,
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
} from '@mui/icons-material';
import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  PageLoading,
  SectionCard,
  StatCard,
  StatusChip,
} from '../../components/common';
import { formatCurrency, formatDate } from '../../theme/tokens';
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

export default function GuestDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const [reservRes, favRes] = await Promise.all([
        reservationsApi.getAll({ limit: 1000 }),
        favoritesApi.getAll(),
      ]);

      setReservations(reservRes.data?.data?.data || reservRes.data?.data || reservRes.data || []);
      setFavorites(favRes.data?.data || favRes.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const now = dayjs();

  const upcoming = reservations
    .filter((r) => r.status !== 'CANCELADA' && dayjs(r.checkIn).isAfter(now))
    .sort((a, b) => dayjs(a.checkIn).diff(dayjs(b.checkIn)));

  const recent = [...reservations]
    .sort((a, b) => dayjs(b.criadoEm).diff(dayjs(a.criadoEm)))
    .slice(0, 5);

  const nextReservation = upcoming[0];
  const nextTripInDays = nextReservation
    ? Math.max(1, dayjs(nextReservation.checkIn).startOf('day').diff(dayjs().startOf('day'), 'day'))
    : 0;

  const totalReservations = reservations.length;
  const activeCount = reservations.filter(
    (r) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO',
  ).length;
  const finalizedCount = reservations.filter((r) => r.status === 'FINALIZADA').length;

  const getCapaUrl = (est: Reservation['estabelecimento'] | undefined) => {
    const capa = est?.fotos?.find((f) => f.isCapa);
    return capa?.url || est?.fotos?.[0]?.url || '';
  };

  const firstName = user?.nome?.split(' ')[0] || 'Hóspede';
  const todayLabel = dayjs().format('dddd, D [de] MMMM [de] YYYY');
  const today = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        icon={<EventAvailable />}
        overline="Área do hóspede"
        title={`Olá, ${firstName}`}
        subtitle={`${today}. Aqui está o resumo das suas viagens e reservas.`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadData}
              disabled={loading}
            >
              Atualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<Search />}
              onClick={() => navigate('/busca')}
            >
              Buscar hospedagens
            </Button>
          </>
        }
      />

      {loading ? (
        <PageLoading label="Carregando seu painel…" minHeight="40vh" />
      ) : error ? (
        <ErrorState
          title="Não foi possível carregar seu painel"
          description="Verifique sua conexão e tente novamente."
          onRetry={loadData}
        />
      ) : (
        <>
          {/* Indicadores — todos derivados das reservas e favoritos reais */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Próxima viagem"
                value={
                  nextReservation
                    ? `${nextTripInDays} ${nextTripInDays === 1 ? 'dia' : 'dias'}`
                    : '—'
                }
                icon={<EventAvailable />}
                tone="primary"
                hint={
                  nextReservation
                    ? `${nextReservation.estabelecimento?.nome || 'Estabelecimento'} · ${formatDate(
                        nextReservation.checkIn,
                      )}`
                    : 'Nenhuma estada futura agendada'
                }
                onClick={() => navigate('/hospede/reservas')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Reservas ativas"
                value={activeCount}
                icon={<Schedule />}
                tone="warning"
                hint={`${totalReservations} reserva${totalReservations === 1 ? '' : 's'} no total`}
                onClick={() => navigate('/hospede/reservas')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Finalizadas"
                value={finalizedCount}
                icon={<CheckCircle />}
                tone="success"
                hint="Estadias concluídas"
                onClick={() => navigate('/hospede/reservas')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Favoritos"
                value={favorites.length}
                icon={<Favorite />}
                tone="secondary"
                hint="Estabelecimentos salvos"
                onClick={() => navigate('/hospede/favoritos')}
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Próximas viagens */}
            <Grid size={{ xs: 12, md: 7 }}>
              <SectionCard
                title="Próximas viagens"
                subtitle="Suas próximas estadias, ordenadas pela data de check-in."
                action={
                  upcoming.length > 0 ? (
                    <Button
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => navigate('/hospede/reservas')}
                    >
                      Ver todas
                    </Button>
                  ) : undefined
                }
                sx={{ height: '100%' }}
              >
                {upcoming.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Hotel />}
                    title="Nenhuma estada futura"
                    description="Explore hospedagens no Rio Grande do Norte e planeje sua próxima viagem."
                    action={
                      <Button variant="contained" startIcon={<Search />} onClick={() => navigate('/busca')}>
                        Buscar hospedagens
                      </Button>
                    }
                  />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {upcoming.slice(0, 3).map((res) => {
                      const cover = getCapaUrl(res.estabelecimento);
                      const nights = Math.max(
                        1,
                        dayjs(res.checkOut).diff(dayjs(res.checkIn), 'day'),
                      );

                      return (
                        <Box
                          key={res.id}
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 3,
                            overflow: 'hidden',
                            transition: 'border-color 180ms',
                            '&:hover': { borderColor: 'primary.main' },
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: '100%', sm: 132 },
                              minWidth: { xs: '100%', sm: 132 },
                              height: { xs: 140, sm: 'auto' },
                              flexShrink: 0,
                              bgcolor: 'action.hover',
                            }}
                          >
                            {cover ? (
                              <CardMedia
                                component="img"
                                image={cover}
                                alt={`Foto de ${res.estabelecimento?.nome || 'estabelecimento'}`}
                                loading="lazy"
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'text.disabled',
                                }}
                              >
                                <Hotel aria-hidden />
                              </Box>
                            )}
                          </Box>

                          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                {res.estabelecimento?.nome || 'Estabelecimento'}
                              </Typography>
                              <StatusChip status={res.status} />
                            </Box>

                            <Typography
                              variant="body2"
                              color="textSecondary"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                            >
                              <Place aria-hidden sx={{ fontSize: 16 }} />
                              {res.quarto?.nome || 'Quarto'} ·{' '}
                              {res.estabelecimento?.cidade?.nome}, {res.estabelecimento?.cidade?.estado}
                            </Typography>

                            <Typography variant="body2" color="textSecondary">
                              {formatDate(res.checkIn)} a {formatDate(res.checkOut)} · {nights}{' '}
                              {nights === 1 ? 'noite' : 'noites'}
                            </Typography>

                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                mt: 'auto',
                                pt: 1.5,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {formatCurrency(res.valorTotal)}
                              </Typography>
                              <Button
                                size="small"
                                endIcon={<ArrowForward />}
                                onClick={() => navigate('/hospede/reservas')}
                              >
                                Ver detalhes
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* Favoritos recentes */}
            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard
                title="Favoritos recentes"
                subtitle="Acesso rápido aos lugares que você salvou."
                action={
                  favorites.length > 0 ? (
                    <Button
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => navigate('/hospede/favoritos')}
                    >
                      Ver todos
                    </Button>
                  ) : undefined
                }
                sx={{ height: '100%' }}
              >
                {favorites.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Favorite />}
                    title="Nenhum favorito ainda"
                    description="Salve estabelecimentos para encontrá-los rapidamente na hora de reservar."
                    action={
                      <Button variant="contained" startIcon={<Search />} onClick={() => navigate('/busca')}>
                        Explorar hospedagens
                      </Button>
                    }
                  />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {favorites.slice(0, 4).map((fav, index) => {
                      const nota = Number(fav.estabelecimento?.notaMedia) || 0;

                      return (
                        <Box key={fav.id}>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => navigate(`/hospedagem/${fav.estabelecimento.id}`)}
                            sx={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              py: 1.5,
                              px: 1,
                              border: 0,
                              borderRadius: 2,
                              bgcolor: 'transparent',
                              color: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                              font: 'inherit',
                              transition: 'background-color 180ms',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <Avatar variant="rounded" sx={{ width: 40, height: 40 }}>
                              <Hotel fontSize="small" />
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {fav.estabelecimento.nome}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" noWrap>
                                {fav.estabelecimento.cidade?.nome},{' '}
                                {fav.estabelecimento.cidade?.estado}
                              </Typography>
                            </Box>
                            {nota > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                                <Star aria-hidden sx={{ fontSize: 16, color: 'warning.main' }} />
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {nota.toFixed(1)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          {index < Math.min(favorites.length, 4) - 1 && <Divider />}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* Reservas recentes */}
            <Grid size={{ xs: 12 }}>
              <SectionCard
                title="Reservas recentes"
                subtitle="Últimas solicitações registradas na sua conta."
                action={
                  recent.length > 0 ? (
                    <Button
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => navigate('/hospede/reservas')}
                    >
                      Ver todas
                    </Button>
                  ) : undefined
                }
              >
                {recent.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<CalendarMonth />}
                    title="Você ainda não possui reservas"
                    description="Quando você solicitar uma hospedagem, ela aparecerá aqui."
                    action={
                      <Button variant="contained" startIcon={<Search />} onClick={() => navigate('/busca')}>
                        Buscar hospedagens
                      </Button>
                    }
                  />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {recent.map((res, index) => (
                      <Box key={res.id}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            py: 1.5,
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                          }}
                        >
                          <Avatar
                            src={getCapaUrl(res.estabelecimento) || undefined}
                            variant="rounded"
                            sx={{ width: 44, height: 44, flexShrink: 0 }}
                          >
                            <Hotel fontSize="small" />
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 160 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {res.estabelecimento?.nome || 'Estabelecimento'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {res.quarto?.nome || 'Quarto'} · {formatDate(res.checkIn, { day: '2-digit', month: '2-digit' })} a{' '}
                              {formatDate(res.checkOut, { day: '2-digit', month: '2-digit' })}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
                            {formatCurrency(res.valorTotal)}
                          </Typography>
                          <StatusChip status={res.status} />
                        </Box>
                        {index < recent.length - 1 && <Divider />}
                      </Box>
                    ))}
                  </Box>
                )}
              </SectionCard>
            </Grid>

            {/* Acesso rápido */}
            <Grid size={{ xs: 12 }}>
              <SectionCard title="Acesso rápido" headerDivider={false}>
                <Grid container spacing={2}>
                  {[
                    { label: 'Buscar hospedagens', icon: <Search />, path: '/busca' },
                    { label: 'Minhas reservas', icon: <CalendarMonth />, path: '/hospede/reservas' },
                    { label: 'Favoritos', icon: <Favorite />, path: '/hospede/favoritos' },
                    { label: 'Meu perfil', icon: <Person />, path: '/hospede/perfil' },
                  ].map((item) => (
                    <Grid key={item.path} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={item.icon}
                        onClick={() => navigate(item.path)}
                        sx={{ justifyContent: 'flex-start', py: 1.75 }}
                      >
                        {item.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      )}
    </PageContainer>
  );
}
