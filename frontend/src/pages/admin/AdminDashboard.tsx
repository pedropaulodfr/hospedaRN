import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Button,
  IconButton,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  People,
  Business,
  BookOnline,
  AttachMoney,
  LocationCity,
  EmojiEvents,
  Add,
  ArrowForward,
} from '@mui/icons-material';
import { reportsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  totalEstablishments: number;
  totalReservations: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, eventsRes] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.upcomingEvents(),
      ]);

      setStats(statsRes.data.data);
      setUpcomingEvents(eventsRes.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  const kpis = [
    {
      title: 'Total de Usuários',
      value: stats?.totalUsers || 0,
      icon: <People sx={{ fontSize: 32, color: '#7C3AED' }} />,
      bgColor: 'rgba(124, 58, 237, 0.08)',
      borderColor: 'rgba(124, 58, 237, 0.2)',
    },
    {
      title: 'Estabelecimentos Ativos',
      value: stats?.totalEstablishments || 0,
      icon: <Business sx={{ fontSize: 32, color: '#0097A7' }} />,
      bgColor: 'rgba(0, 151, 167, 0.08)',
      borderColor: 'rgba(0, 151, 167, 0.2)',
    },
    {
      title: 'Total de Reservas',
      value: stats?.totalReservations || 0,
      icon: <BookOnline sx={{ fontSize: 32, color: '#FF7043' }} />,
      bgColor: 'rgba(255, 112, 67, 0.08)',
      borderColor: 'rgba(255, 112, 67, 0.2)',
    },
    {
      title: 'Faturamento Total',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalRevenue || 0),
      icon: <AttachMoney sx={{ fontSize: 32, color: '#4CAF50' }} />,
      bgColor: 'rgba(76, 175, 80, 0.08)',
      borderColor: 'rgba(76, 175, 80, 0.2)',
    },
  ];

  return (
    <Box sx={{ p: 4, maxWidth: 1400, margin: '0 auto' }}>
      {/* Title */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
            Painel Geral
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visão unificada das operações, cidades, eventos e novos estabelecimentos.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={fetchData}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
        >
          Atualizar Dados
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpis.map((kpi, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card
              sx={{
                borderRadius: '16px',
                border: '1px solid',
                borderColor: kpi.borderColor,
                bgcolor: 'background.paper',
                boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.03)',
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: kpi.bgColor,
                  }}
                >
                  {kpi.icon}
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {kpi.title}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                    {kpi.value}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions & Events */}
      <Stack spacing={4}>
        {/* Quick Actions Card */}
        <Paper
          sx={{
            p: 3,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 2.5 }}>
            Ações Rápidas
          </Typography>
          <Stack spacing={2}>
            <Button
              component={Link}
              to="/admin/estabelecimentos"
              variant="contained"
              color="primary"
              startIcon={<Add />}
              fullWidth
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                height: 46,
                background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                boxShadow: '0 4px 14px 0 rgba(0, 151, 167, 0.3)',
              }}
            >
              Novo Estabelecimento
            </Button>
            <Button
              component={Link}
              to="/admin/cidades"
              variant="outlined"
              color="primary"
              startIcon={<LocationCity />}
              fullWidth
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, height: 46 }}
            >
              Gerenciar Cidades
            </Button>
            <Button
              component={Link}
              to="/admin/eventos"
              variant="outlined"
              color="secondary"
              startIcon={<EmojiEvents />}
              fullWidth
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
                height: 46,
                color: '#FF7043',
                borderColor: '#FF7043',
                '&:hover': {
                  borderColor: '#FF5722',
                  bgcolor: 'rgba(255, 112, 67, 0.04)',
                },
              }}
            >
              Gerenciar Eventos
            </Button>
          </Stack>
        </Paper>

        {/* Upcoming Events List */}
        <Paper
          sx={{
            p: 3,
            borderRadius: '20px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
              Eventos Próximos
            </Typography>
            <IconButton size="small" component={Link} to="/admin/eventos" color="primary">
              <ArrowForward />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            {upcomingEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                Nenhum evento agendado em breve.
              </Typography>
            ) : (
              upcomingEvents.map((evt) => (
                <Box
                  key={evt.id}
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    bgcolor: 'rgba(0,0,0,0.01)',
                    borderLeft: '4px solid #FF7043',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {evt.nome}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {new Date(evt.dataInicio).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(evt.dataFim).toLocaleDateString('pt-BR')}
                  </Typography>
                </Box>
              ))
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
