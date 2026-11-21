import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  People,
  Business,
  BookOnline,
  AttachMoney,
  LocationCity,
  EmojiEvents,
  Add,
  ArrowForward,
  Refresh,
  Assessment,
} from '@mui/icons-material';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  ErrorState,
  PageLoading,
} from '../../components/common';
import { formatCurrency, formatDate } from '../../theme/tokens';
import { reportsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  totalEstablishments: number;
  totalReservations: number;
  totalRevenue: number;
}

interface UpcomingEvent {
  id: string;
  nome: string;
  dataInicio?: string;
  dataFim?: string;
}

/** Devolve dia e mês abreviado de uma data ISO, ou `null` quando inválida. */
function dateBadge(value?: string): { day: string; month: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
  };
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
      const [statsRes, eventsRes] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.upcomingEvents(),
      ]);

      setStats(statsRes.data.data);
      setUpcomingEvents(eventsRes.data.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showInitialLoading = loading && !stats;
  const showError = error && !stats;

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        overline="Administração"
        title="Painel geral"
        subtitle="Visão unificada das operações, cidades, eventos e estabelecimentos da plataforma."
        icon={<Assessment />}
        actions={
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchData}
            disabled={loading}
          >
            Atualizar
          </Button>
        }
      />

      {showInitialLoading ? (
        <PageLoading label="Carregando indicadores…" />
      ) : showError ? (
        <ErrorState
          title="Não foi possível carregar o painel"
          description="Ocorreu uma falha ao buscar os indicadores e os próximos eventos."
          onRetry={fetchData}
        />
      ) : (
        <Stack spacing={{ xs: 3, md: 4 }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 2, sm: 2.5 },
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            <StatCard
              label="Usuários"
              value={stats?.totalUsers ?? 0}
              icon={<People />}
              tone="primary"
              hint="Contas cadastradas"
              loading={loading}
            />
            <StatCard
              label="Estabelecimentos"
              value={stats?.totalEstablishments ?? 0}
              icon={<Business />}
              tone="info"
              hint="Ativos na plataforma"
              loading={loading}
            />
            <StatCard
              label="Reservas"
              value={stats?.totalReservations ?? 0}
              icon={<BookOnline />}
              tone="secondary"
              hint="Total registrado"
              loading={loading}
            />
            <StatCard
              label="Faturamento"
              value={formatCurrency(stats?.totalRevenue ?? 0)}
              icon={<AttachMoney />}
              tone="success"
              hint="Receita consolidada"
              loading={loading}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: { xs: 3, lg: 3 },
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 7fr)' },
              alignItems: 'start',
            }}
          >
            <SectionCard
              title="Ações rápidas"
              subtitle="Atalhos para as tarefas mais frequentes do painel."
            >
              <Stack spacing={1.5}>
                <Button
                  component={RouterLink}
                  to="/admin/estabelecimentos"
                  variant="contained"
                  startIcon={<Add />}
                  fullWidth
                >
                  Novo estabelecimento
                </Button>
                <Button
                  component={RouterLink}
                  to="/admin/cidades"
                  variant="outlined"
                  startIcon={<LocationCity />}
                  fullWidth
                >
                  Gerenciar cidades
                </Button>
                <Button
                  component={RouterLink}
                  to="/admin/eventos"
                  variant="outlined"
                  color="secondary"
                  startIcon={<EmojiEvents />}
                  fullWidth
                >
                  Gerenciar eventos
                </Button>
                <Button
                  component={RouterLink}
                  to="/admin/relatorios"
                  variant="text"
                  startIcon={<Assessment />}
                  endIcon={<ArrowForward />}
                  fullWidth
                >
                  Ver relatórios
                </Button>
              </Stack>
            </SectionCard>

            <SectionCard
              title="Eventos próximos"
              subtitle="Agenda regional com as datas de cada evento."
              action={
                <Button
                  component={RouterLink}
                  to="/admin/eventos"
                  size="small"
                  endIcon={<ArrowForward />}
                >
                  Ver todos
                </Button>
              }
            >
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  compact
                  icon={<EmojiEvents />}
                  title="Nenhum evento agendado"
                  description="Cadastre eventos regionais para destacá-los na plataforma."
                  action={
                    <Button
                      component={RouterLink}
                      to="/admin/eventos"
                      variant="outlined"
                      size="small"
                      startIcon={<Add />}
                    >
                      Cadastrar evento
                    </Button>
                  }
                />
              ) : (
                <Stack spacing={1.5}>
                  {upcomingEvents.map((evt) => {
                    const badge = dateBadge(evt.dataInicio);
                    return (
                      <Box
                        key={evt.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          p: 1.5,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          transition: 'border-color 180ms, background-color 180ms',
                          '&:hover': {
                            borderColor: (t) => alpha(t.palette.primary.main, 0.45),
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <Box
                          aria-hidden
                          sx={{
                            width: 52,
                            minWidth: 52,
                            py: 1,
                            borderRadius: 2,
                            textAlign: 'center',
                            bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
                            color: 'secondary.main',
                          }}
                        >
                          <Typography
                            component="span"
                            sx={{ display: 'block', fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.1 }}
                          >
                            {badge?.day ?? '--'}
                          </Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ display: 'block', fontWeight: 600, textTransform: 'uppercase' }}
                          >
                            {badge?.month ?? '—'}
                          </Typography>
                        </Box>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                            {evt.nome}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatDate(evt.dataInicio)}
                            {evt.dataFim ? ` até ${formatDate(evt.dataFim)}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                  <Divider />
                  <Typography variant="caption" color="textSecondary">
                    {upcomingEvents.length}{' '}
                    {upcomingEvents.length === 1 ? 'evento programado' : 'eventos programados'}
                  </Typography>
                </Stack>
              )}
            </SectionCard>
          </Box>
        </Stack>
      )}
    </PageContainer>
  );
}
