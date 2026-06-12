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
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import {
  Refresh,
  ArrowForward,
  Hotel,
  TrendingUp,
  CalendarMonth,
  AttachMoney,
  Star,
  MeetingRoom,
  People,
  PhotoLibrary,
  Receipt,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Bed,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { establishmentsApi, reservationsApi, reportsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

dayjs.locale('pt-br');

interface Reservation {
  id: string;
  codigoReserva: string;
  hospedeId: string;
  estabelecimentoId: string;
  quartoId: string;
  checkIn: string;
  checkOut: string;
  adultos: number;
  criancas: number;
  valorTotal: number | string;
  status: 'SOLICITADA' | 'CONFIRMADA' | 'AGUARDANDO_PAGAMENTO' | 'FINALIZADA' | 'CANCELADA';
  observacoes?: string;
  hospede?: { id: string; nome: string; email: string; telefone?: string };
  quarto?: { id: string; nome: string; capacidade: number };
}

interface StatusSummary {
  status: string;
  _count: { id: number };
  _sum: { valorTotal: number | null };
}

interface OccupancyReport {
  mes: number;
  ano: number;
  totalQuartos: number;
  totalDias: number;
  diasOcupados: number;
  taxaOcupacao: string;
  reservasConfirmadas: number;
  reservasFinalizadas: number;
  faturamentoEstimado: number;
}

interface EstablishmentDetail {
  id: string;
  nome: string;
  notaMedia?: number | string;
  totalAvaliacoes?: number;
  _count?: { quartos: number; reservas: number };
  quartos?: any[];
  fotoPerfil?: string;
  endereco?: string;
  criadoEm?: string;
}

const statusChipConfig: Record<string, { label: string; color: 'info' | 'warning' | 'success' | 'error' }> = {
  SOLICITADA:           { label: 'Solicitada',           color: 'info' },
  CONFIRMADA:           { label: 'Confirmada',           color: 'warning' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguard. Pagamento',    color: 'warning' },
  FINALIZADA:           { label: 'Finalizada',           color: 'success' },
  CANCELADA:            { label: 'Cancelada',            color: 'error' },
};

const CHART_COLORS: Record<string, string> = {
  SOLICITADA:           '#0288d1',
  CONFIRMADA:           '#ed6c02',
  AGUARDANDO_PAGAMENTO: '#f59e0b',
  FINALIZADA:           '#2e7d32',
  CANCELADA:            '#d32f2f',
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: '16px',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px 0 rgba(0,0,0,0.04)',
        },
      }}
    >
      <Avatar sx={{ bgcolor: `${color}15`, color, width: 44, height: 44 }}>
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function EstDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [establishments, setEstablishments] = useState<{ id: string; nome: string }[]>([]);
  const [selectedEstId, setSelectedEstId] = useState<string>('');
  const [establishment, setEstablishment] = useState<EstablishmentDetail | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [statusData, setStatusData] = useState<StatusSummary[]>([]);
  const [recentReservations, setRecentReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const loadEstablishments = async () => {
    try {
      const res = await establishmentsApi.getMy();
      const list = res.data.data || res.data || [];
      setEstablishments(list);
      if (list.length > 0) {
        const linkedId = (user as any)?.estabelecimentoVinculadoId;
        const initial = linkedId && list.find((e: any) => e.id === linkedId)
          ? linkedId
          : list[0].id;
        setSelectedEstId(initial);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar estabelecimentos');
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    if (!selectedEstId) return;
    setDashboardLoading(true);
    try {
      const now = dayjs();
      const month = now.month() + 1;
      const year = now.year();

      const [estRes, occRes, statusRes, reservasRes] = await Promise.all([
        establishmentsApi.getOne(selectedEstId),
        reportsApi.occupancy(selectedEstId, month, year),
        reportsApi.byStatus(selectedEstId),
        reservationsApi.getAll({ estabelecimentoId: selectedEstId, limit: 5 }),
      ]);

      setEstablishment(estRes.data.data || estRes.data);
      setOccupancy(occRes.data.data || occRes.data);
      setStatusData(statusRes.data.data || statusRes.data || []);
      setRecentReservations(reservasRes.data.data?.data || reservasRes.data.data || reservasRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    loadEstablishments();
  }, []);

  useEffect(() => {
    if (selectedEstId) loadDashboard();
  }, [selectedEstId]);

  const formatCurrency = (value: number | string) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

  const totalReservations = statusData.reduce((acc, s) => acc + s._count.id, 0);
  const confirmedCount = statusData.find(s => s.status === 'CONFIRMADA')?._count?.id || 0;
  const finalizedCount = statusData.find(s => s.status === 'FINALIZADA')?._count?.id || 0;
  const canceledCount = statusData.find(s => s.status === 'CANCELADA')?._count?.id || 0;
  const pendingCount = statusData.find(s => s.status === 'SOLICITADA')?._count?.id || 0;

  const chartData = statusData.map(s => ({
    name: statusChipConfig[s.status]?.label || s.status,
    value: s._count.id,
    color: CHART_COLORS[s.status] || '#999',
  }));

  const quickActions = [
    { label: 'Quartos',     icon: <MeetingRoom />,  path: '/estabelecimento/quartos',  color: '#0097A7' },
    { label: 'Reservas',    icon: <Receipt />,       path: '/estabelecimento/reservas', color: '#FF7043' },
    { label: 'Fotos',       icon: <PhotoLibrary />,  path: '/estabelecimento/fotos',    color: '#10B981' },
    { label: 'Preços',      icon: <AttachMoney />,   path: '/estabelecimento/precos',   color: '#F59E0B' },
  ];

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
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {dayjs().format('dddd, D [de] MMMM [de] YYYY')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {establishments.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Estabelecimento</InputLabel>
              <Select
                value={selectedEstId}
                label="Estabelecimento"
                onChange={(e) => setSelectedEstId(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                {establishments.map((est) => (
                  <MenuItem key={est.id} value={est.id}>{est.nome}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDashboard}
            disabled={dashboardLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
          >
            Atualizar
          </Button>
        </Box>
      </Box>

      {!selectedEstId ? (
        <Paper sx={{ p: 8, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Hotel sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Nenhum estabelecimento encontrado
          </Typography>
          <Typography color="text.secondary">
            Você precisa ter um estabelecimento cadastrado para acessar o dashboard.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Quick Stats */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <StatCard
                icon={<Hotel sx={{ fontSize: 22 }} />}
                label="Quartos Ativos"
                value={occupancy?.totalQuartos ?? '—'}
                color="#0097A7"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <StatCard
                icon={<TrendingUp sx={{ fontSize: 22 }} />}
                label="Taxa de Ocupação"
                value={occupancy?.taxaOcupacao ?? '—'}
                color="#10B981"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <StatCard
                icon={<CalendarMonth sx={{ fontSize: 22 }} />}
                label="Reservas (mês)"
                value={totalReservations}
                color="#F59E0B"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <StatCard
                icon={<AttachMoney sx={{ fontSize: 22 }} />}
                label="Faturamento (mês)"
                value={occupancy ? formatCurrency(occupancy.faturamentoEstimado) : '—'}
                color="#10B981"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <StatCard
                icon={<Star sx={{ fontSize: 22 }} />}
                label="Avaliação"
                value={establishment?.notaMedia && Number(establishment.notaMedia) > 0
                  ? `${Number(establishment.notaMedia).toFixed(1)}`
                  : '—'}
                color="#F59E0B"
              />
            </Grid>
          </Grid>

          {/* Summary Mini Cards */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0288d1' }}>{pendingCount}</Typography>
                <Typography variant="caption" color="text.secondary">Pendentes</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#ed6c02' }}>{confirmedCount}</Typography>
                <Typography variant="caption" color="text.secondary">Confirmadas</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32' }}>{finalizedCount}</Typography>
                <Typography variant="caption" color="text.secondary">Finalizadas</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Paper sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#d32f2f' }}>{canceledCount}</Typography>
                <Typography variant="caption" color="text.secondary">Canceladas</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Main Content */}
          <Grid container spacing={3}>
            {/* Reservations by Status Chart */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
                  Distribuição por Status
                </Typography>

                {chartData.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">Nenhuma reserva neste mês.</Typography>
                  </Box>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid rgba(0,0,0,0.08)',
                            fontSize: '13px',
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {chartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2, justifyContent: 'center' }}>
                      {chartData.map((item) => (
                        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: item.color }} />
                          <Typography variant="caption" color="text.secondary">
                            {item.name}: {item.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>

            {/* Recent Reservations */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
                    Últimas Reservas
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/estabelecimento/reservas')}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                  >
                    Ver todas
                  </Button>
                </Box>

                {recentReservations.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">Nenhuma reserva recente.</Typography>
                  </Box>
                ) : (
                  recentReservations.map((res) => (
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
                      <Avatar sx={{ bgcolor: 'rgba(0,151,167,0.1)', color: 'primary.main', width: 40, height: 40 }}>
                        <People sx={{ fontSize: 20 }} />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {res.hospede?.nome || 'Hóspede'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {res.quarto?.nome || 'Quarto'} · {res.adultos || 0} adulto{res.adultos !== 1 ? 's' : ''}
                          {res.criancas ? ` · ${res.criancas} criança${res.criancas !== 1 ? 's' : ''}` : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {dayjs(res.checkIn).format('DD/MM')} - {dayjs(res.checkOut).format('DD/MM')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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

            {/* Quick Actions */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, borderRadius: '20px', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
                  Acesso Rápido
                </Typography>
                <Grid container spacing={2}>
                  {quickActions.map((item) => (
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
                          '&:hover': {
                            borderColor: item.color,
                            bgcolor: `${item.color}08`,
                          },
                        }}
                      >
                        {item.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
