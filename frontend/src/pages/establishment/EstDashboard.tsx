import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowForward,
  AttachMoney,
  CalendarMonth,
  EventAvailable,
  Hotel,
  HourglassEmpty,
  MeetingRoom,
  OpenInNew,
  PhotoLibrary,
  Receipt,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
  StatusChip,
  TableSkeleton,
  toneBorder,
  toneColor,
  toneSurface,
} from '../../components/common';
import type { Tone } from '../../theme/tokens';
import { formatCurrency, radius, statusMeta } from '../../theme/tokens';
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

/** Status que ainda podem gerar uma chegada (não encerrados nem cancelados). */
const STATUS_COM_CHEGADA = ['SOLICITADA', 'CONFIRMADA', 'AGUARDANDO_PAGAMENTO'];

/** Quantidade de reservas mais recentes usada nas listas e na contagem de check-ins. */
const RESERVAS_RECENTES_JANELA = 20;

interface ManagementShortcut {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  tone: Tone;
}

export default function EstDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();

  const [establishments, setEstablishments] = useState<{ id: string; nome: string }[]>([]);
  const [selectedEstId, setSelectedEstId] = useState<string>('');
  const [establishment, setEstablishment] = useState<EstablishmentDetail | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [statusData, setStatusData] = useState<StatusSummary[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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
    setDashboardError(null);
    try {
      const now = dayjs();
      const month = now.month() + 1;
      const year = now.year();

      const [estRes, occRes, statusRes, reservasRes] = await Promise.all([
        establishmentsApi.getOne(selectedEstId),
        reportsApi.occupancy(selectedEstId, month, year),
        reportsApi.byStatus(selectedEstId),
        reservationsApi.getAll({ estabelecimentoId: selectedEstId, limit: RESERVAS_RECENTES_JANELA }),
      ]);

      setEstablishment(estRes.data.data || estRes.data);
      setOccupancy(occRes.data.data || occRes.data);
      setStatusData(statusRes.data.data || statusRes.data || []);
      setReservations(reservasRes.data.data?.data || reservasRes.data.data || reservasRes.data || []);
    } catch (err: any) {
      console.error(err);
      setDashboardError(
        err.response?.data?.message || 'Não foi possível carregar os dados do dashboard.',
      );
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

  /** Enquanto a primeira carga não chega, tudo é esqueleto (sem salto de layout). */
  const booting = loading || (dashboardLoading && !establishment);

  /** Reservas mais recentes — as cinco primeiras da janela carregada. */
  const recentReservations = useMemo(() => reservations.slice(0, 5), [reservations]);

  /** Próximas chegadas, ordenadas por data de entrada a partir de hoje. */
  const upcomingCheckIns = useMemo(() => {
    const today = dayjs().startOf('day');
    return reservations
      .filter((res) => STATUS_COM_CHEGADA.includes(res.status) && !dayjs(res.checkIn).isBefore(today))
      .sort((a, b) => dayjs(a.checkIn).valueOf() - dayjs(b.checkIn).valueOf());
  }, [reservations]);

  const pendingCount =
    statusData.find((s) => s.status === 'SOLICITADA')?._count?.id || 0;
  const totalReservations = statusData.reduce((acc, s) => acc + s._count.id, 0);

  const chartData = useMemo(
    () =>
      statusData.map((s) => ({
        name: statusMeta[s.status]?.label || s.status,
        value: s._count.id,
        color:
          s.status === 'CANCELADA'
            ? theme.palette.error.main
            : s.status === 'CONFIRMADA'
              ? theme.palette.success.main
              : s.status === 'AGUARDANDO_PAGAMENTO'
                ? theme.palette.info.main
                : s.status === 'FINALIZADA'
                  ? theme.palette.text.secondary
                  : theme.palette.warning.main,
      })),
    [statusData, theme],
  );

  const monthLabel = dayjs().format('MMMM [de] YYYY');
  const todayLabel = useMemo(() => {
    const raw = dayjs().format('dddd, D [de] MMMM [de] YYYY');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  /** Quartos do estabelecimento: relatório de ocupação manda, contagem é o fallback. */
  const roomsCount = occupancy?.totalQuartos ?? establishment?._count?.quartos ?? 0;
  const notaMedia = Number(establishment?.notaMedia);
  const avaliacaoLabel =
    notaMedia > 0
      ? `Avaliação ${notaMedia.toFixed(1)}${
          establishment?.totalAvaliacoes
            ? ` (${establishment.totalAvaliacoes} ${
                establishment.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'
              })`
            : ''
        }`
      : 'Sem avaliações ainda';

  const managementShortcuts: ManagementShortcut[] = [
    {
      label: 'Reservas',
      description: 'Analisar, confirmar e finalizar solicitações.',
      icon: <Receipt />,
      path: '/estabelecimento/reservas',
      tone: 'info',
    },
    {
      label: 'Quartos',
      description: 'Quartos, capacidade e disponibilidade.',
      icon: <MeetingRoom />,
      path: '/estabelecimento/quartos',
      tone: 'primary',
    },
    {
      label: 'Fotos',
      description: 'Galeria de fotos do estabelecimento.',
      icon: <PhotoLibrary />,
      path: '/estabelecimento/fotos',
      tone: 'secondary',
    },
    {
      label: 'Preços',
      description: 'Tarifas e temporadas por quarto.',
      icon: <AttachMoney />,
      path: '/estabelecimento/precos',
      tone: 'warning',
    },
    {
      label: 'Relatórios',
      description: 'Ocupação e faturamento do período.',
      icon: <TrendingUp />,
      path: '/estabelecimento/relatorios',
      tone: 'success',
    },
  ];

  /** Wrapper de link para os indicadores navegáveis (foco por teclado preservado). */
  const linkCardSx = {
    display: 'block',
    height: '100%',
    color: 'inherit',
    textDecoration: 'none',
    borderRadius: `${radius.xl}px`,
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: 2,
    },
  };

  /** Bloco de linha de reserva reaproveitado nas duas listas. */
  const renderReservationTable = (
    rows: Reservation[],
    emptyState: React.ReactNode,
    tableLabel: string,
  ) => {
    if (rows.length === 0) return emptyState;

    return (
      <>
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
          <Table size="small" aria-label={tableLabel}>
            <TableHead>
              <TableRow>
                <TableCell>Hóspede</TableCell>
                <TableCell>Quarto</TableCell>
                <TableCell>Período</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 56 }} aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((res) => (
                <TableRow key={res.id} hover>
                  <TableCell sx={{ py: 1.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {res.hospede?.nome || 'Hóspede'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {res.codigoReserva}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.25 }}>
                    <Typography variant="body2" color="textSecondary">
                      {res.quarto?.nome || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">
                      {dayjs(res.checkIn).format('DD/MM')} – {dayjs(res.checkOut).format('DD/MM')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(res.valorTotal)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.25 }}>
                    <StatusChip status={res.status} />
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <IconButton
                      size="small"
                      aria-label={`Ver reservas — ${res.hospede?.nome || res.codigoReserva}`}
                      onClick={() => navigate('/estabelecimento/reservas')}
                    >
                      <ArrowForward fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack spacing={1.25} sx={{ display: { xs: 'flex', sm: 'none' }, px: 2.5, py: 2 }}>
          {rows.map((res) => (
            <Box
              key={res.id}
              sx={{
                p: 2,
                borderRadius: `${radius.lg}px`,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1,
                  mb: 0.75,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                    {res.hospede?.nome || 'Hóspede'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {res.codigoReserva}
                  </Typography>
                </Box>
                <StatusChip status={res.status} />
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                {res.quarto?.nome || 'Quarto a definir'}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {dayjs(res.checkIn).format('DD/MM')} – {dayjs(res.checkOut).format('DD/MM')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatCurrency(res.valorTotal)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </>
    );
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Painel do estabelecimento"
        title={establishment?.nome || 'Visão geral'}
        subtitle={
          <>
            {todayLabel}
            {establishment?.endereco ? ` · ${establishment.endereco}` : ''}
          </>
        }
        icon={
          establishment?.fotoPerfil ? (
            <Avatar
              src={establishment.fotoPerfil}
              alt={`Foto de ${establishment.nome}`}
              variant="rounded"
              sx={{ width: 44, height: 44 }}
            />
          ) : (
            <Hotel />
          )
        }
        actions={
          <>
            {establishments.length > 1 && (
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="est-dashboard-select-label">Estabelecimento</InputLabel>
                <Select
                  labelId="est-dashboard-select-label"
                  value={selectedEstId}
                  label="Estabelecimento"
                  onChange={(e) => setSelectedEstId(e.target.value)}
                >
                  {establishments.map((est) => (
                    <MenuItem key={est.id} value={est.id}>
                      {est.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Button
              variant="outlined"
              size="medium"
              startIcon={
                dashboardLoading ? <CircularProgress size={16} color="inherit" /> : <Refresh />
              }
              onClick={loadDashboard}
              disabled={dashboardLoading || !selectedEstId}
            >
              Atualizar
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<OpenInNew />}
              onClick={() => navigate(`/hospedagem/${selectedEstId}`)}
              disabled={!selectedEstId || booting}
            >
              Ver site público
            </Button>
          </>
        }
      />

      {!selectedEstId && !booting ? (
        <SectionCard>
          <EmptyState
            title="Nenhum estabelecimento encontrado"
            description="Você precisa ter um estabelecimento cadastrado para acessar o dashboard."
            icon={<Hotel />}
            action={
              <Button variant="outlined" component={RouterLink} to="/estabelecimento/perfil">
                Ir para o perfil
              </Button>
            }
          />
        </SectionCard>
      ) : dashboardError && !establishment ? (
        <SectionCard>
          <ErrorState
            title="Não foi possível carregar o dashboard"
            description={dashboardError}
            onRetry={loadDashboard}
          />
        </SectionCard>
      ) : (
        <Stack spacing={3}>
          {/* Indicadores do período */}
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box
                component={RouterLink}
                to="/estabelecimento/reservas"
                sx={linkCardSx}
              >
                <StatCard
                  label="Aguardando confirmação"
                  value={pendingCount}
                  icon={<HourglassEmpty />}
                  tone="warning"
                  hint="Solicitações para analisar"
                  loading={booting}
                  sx={{ borderRadius: `${radius.xl}px` }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box
                component={RouterLink}
                to="/estabelecimento/reservas"
                sx={linkCardSx}
              >
                <StatCard
                  label="Check-ins próximos"
                  value={upcomingCheckIns.length}
                  icon={<EventAvailable />}
                  tone="info"
                  hint="A partir de hoje"
                  loading={booting}
                  sx={{ borderRadius: `${radius.xl}px` }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box
                component={RouterLink}
                to="/estabelecimento/relatorios"
                sx={linkCardSx}
              >
                <StatCard
                  label="Taxa de ocupação"
                  value={occupancy?.taxaOcupacao ?? '—'}
                  icon={<TrendingUp />}
                  tone="success"
                  hint={monthLabel}
                  loading={booting}
                  sx={{ borderRadius: `${radius.xl}px` }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box
                component={RouterLink}
                to="/estabelecimento/relatorios"
                sx={linkCardSx}
              >
                <StatCard
                  label="Receita do período"
                  value={occupancy ? formatCurrency(occupancy.faturamentoEstimado) : '—'}
                  icon={<AttachMoney />}
                  tone="primary"
                  hint={`Faturamento estimado · ${monthLabel}`}
                  loading={booting}
                  sx={{ borderRadius: `${radius.xl}px` }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Próximos check-ins + distribuição por status */}
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <SectionCard
                title="Próximos check-ins"
                subtitle="Chegadas previstas a partir de hoje, em ordem de entrada."
                noPadding
                action={
                  <Button
                    size="small"
                    component={RouterLink}
                    to="/estabelecimento/reservas"
                    endIcon={<ArrowForward />}
                  >
                    Ver reservas
                  </Button>
                }
                contentSx={{ display: 'flex', flexDirection: 'column' }}
              >
                {booting ? (
                  <Box sx={{ p: 2.5 }}>
                    <TableSkeleton rows={5} columns={4} />
                  </Box>
                ) : (
                  <>
                    {renderReservationTable(
                      upcomingCheckIns.slice(0, 5),
                      <EmptyState
                        compact
                        icon={<CalendarMonth />}
                        title="Nenhum check-in previsto"
                        description="Não há chegadas a partir de hoje nas reservas recentes do estabelecimento."
                      />,
                      'Próximos check-ins',
                    )}
                    {reservations.length > 0 && (
                      <Box
                        sx={{
                          mt: 'auto',
                          px: 3,
                          py: 2,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography variant="caption" color="textSecondary">
                          Base: as {reservations.length} reservas mais recentes do estabelecimento.
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <SectionCard
                title="Reservas por status"
                subtitle={
                  totalReservations > 0
                    ? `${totalReservations} reserva${totalReservations === 1 ? '' : 's'} registrada${totalReservations === 1 ? '' : 's'}`
                    : 'Distribuição das reservas do estabelecimento.'
                }
                sx={{ height: '100%' }}
              >
                {booting ? (
                  <TableSkeleton rows={5} columns={2} />
                ) : chartData.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Receipt />}
                    title="Sem reservas por enquanto"
                    description="A distribuição por status aparece assim que houver a primeira reserva."
                  />
                ) : (
                  <>
                    <Box sx={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={theme.palette.divider}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            tickFormatter={(value: string) =>
                              value.length > 12 ? `${value.slice(0, 11)}…` : value
                            }
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                              background: theme.palette.background.paper,
                              color: theme.palette.text.primary,
                              fontSize: 13,
                            }}
                            cursor={{ fill: theme.palette.action.hover }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ mt: 2, flexWrap: 'wrap', gap: 1.5, rowGap: 1 }}
                    >
                      {chartData.map((item) => (
                        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box
                            aria-hidden
                            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            {item.name}: <strong>{item.value}</strong>
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </SectionCard>
            </Grid>
          </Grid>

          {/* Reservas recentes */}
          <SectionCard
            title="Reservas recentes"
            subtitle="Últimas solicitações recebidas pelo estabelecimento."
            noPadding
            action={
              <Button
                size="small"
                component={RouterLink}
                to="/estabelecimento/reservas"
                endIcon={<ArrowForward />}
              >
                Ver todas
              </Button>
            }
          >
            {booting ? (
              <Box sx={{ p: 2.5 }}>
                <TableSkeleton rows={5} columns={6} />
              </Box>
            ) : (
              renderReservationTable(
                recentReservations,
                <EmptyState
                  compact
                  icon={<Receipt />}
                  title="Nenhuma reserva ainda"
                  description="As solicitações de hóspedes aparecem aqui assim que forem criadas."
                  action={
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to="/estabelecimento/reservas"
                    >
                      Ir para reservas
                    </Button>
                  }
                />,
                'Reservas recentes',
              )
            )}
          </SectionCard>

          {/* Atalhos de gestão */}
          <SectionCard
            title="Gestão do estabelecimento"
            subtitle="Acessos rápidos para as áreas que você mais usa."
          >
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(5, minmax(0, 1fr))',
                },
              }}
            >
              {managementShortcuts.map((item) => (
                <Box
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  sx={(t) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    minHeight: 88,
                    borderRadius: `${radius.lg}px`,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    textDecoration: 'none',
                    transition: 'border-color 180ms, background-color 180ms',
                    '&:hover': {
                      borderColor: toneBorder(t, item.tone),
                      bgcolor: 'action.hover',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  })}
                >
                  <Box
                    aria-hidden
                    sx={(t) => ({
                      width: 40,
                      height: 40,
                      borderRadius: `${radius.md}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      bgcolor: toneSurface(t, item.tone),
                      color: toneColor(t, item.tone),
                      '& svg': { fontSize: 20 },
                    })}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                      {item.description}
                    </Typography>
                  </Box>
                  <ArrowForward aria-hidden sx={{ fontSize: 18, color: 'text.secondary' }} />
                </Box>
              ))}
            </Box>
          </SectionCard>

          {/* Resumo do estabelecimento */}
          {establishment && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                color: 'text.secondary',
                px: 0.5,
              }}
            >
              <Typography variant="caption">
                {roomsCount} {roomsCount === 1 ? 'quarto cadastrado' : 'quartos cadastrados'}
              </Typography>
              <Typography variant="caption" aria-hidden>
                ·
              </Typography>
              <Typography variant="caption">{avaliacaoLabel}</Typography>
            </Box>
          )}
        </Stack>
      )}
    </PageContainer>
  );
}
