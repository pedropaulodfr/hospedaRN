import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Assessment,
  AttachMoney,
  BookOnline,
  Cancel,
  Download,
  MoneyOff,
  Print,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DataToolbar,
  DataToolbarGroup,
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  PageLoading,
  SectionCard,
  StatCard,
} from '../../components/common';
import { formatCurrency, statusMeta } from '../../theme/tokens';
import { reportsApi } from '../../services/api';
import toast from 'react-hot-toast';

type PeriodoKey = 'all' | '3' | '6' | '12';

const PERIODO_OPTIONS: Array<{ value: PeriodoKey; label: string }> = [
  { value: 'all', label: 'Todo o período' },
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
];

/** Primeiro dia do mês N meses atrás (inclusive o mês corrente). */
function monthCutoff(months: number): number {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - (months - 1));
  return date.getTime();
}

function statusLabel(status: string): string {
  return statusMeta[status?.toUpperCase?.() ?? '']?.label ?? status;
}

export default function AdminReports() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoKey>('all');
  const [cityData, setCityData] = useState<any[]>([]);
  const [cancellationData, setCancellationData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(false);
      const [cityRes, cancelRes, statusRes] = await Promise.all([
        reportsApi.byCity(),
        reportsApi.cancellations(),
        reportsApi.byStatus(),
      ]);

      setCityData(cityRes.data.data || []);

      const formattedCancel = (cancelRes.data.data || [])
        .map((c: any) => ({
          ...c,
          mesFormatado: new Date(c.mes).toLocaleDateString('pt-BR', {
            month: 'short',
            year: '2-digit',
          }),
          valorPerdido: Number(c.valor_perdido || 0),
          cancelamentos: Number(c.cancelamentos || 0),
        }))
        .reverse();
      setCancellationData(formattedCancel);

      const formattedStatus = (statusRes.data.data || []).map((s: any) => ({
        name: s.status,
        value: s._count?.id || 0,
        receita: Number(s._sum?.valorTotal || 0),
      }));
      setStatusData(formattedStatus);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar relatórios gerenciais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];

    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV baixado com sucesso!');
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredCancellations = useMemo(() => {
    if (periodo === 'all') return cancellationData;
    const cutoff = monthCutoff(Number(periodo));
    return cancellationData.filter((entry) => {
      const parsed = new Date(entry.mes);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= cutoff;
    });
  }, [cancellationData, periodo]);

  const periodoLabel =
    PERIODO_OPTIONS.find((option) => option.value === periodo)?.label ?? 'Todo o período';

  const totals = useMemo(() => {
    const receita = cityData.reduce((acc, row) => acc + Number(row.receita || 0), 0);
    const reservas = cityData.reduce((acc, row) => acc + Number(row.total_reservas || 0), 0);
    const cancelamentos = filteredCancellations.reduce(
      (acc, row) => acc + Number(row.cancelamentos || 0),
      0,
    );
    const valorPerdido = filteredCancellations.reduce(
      (acc, row) => acc + Number(row.valorPerdido || 0),
      0,
    );
    return { receita, reservas, cancelamentos, valorPerdido };
  }, [cityData, filteredCancellations]);

  const chartColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.error.main,
  ];

  const axisTick = { fill: theme.palette.text.secondary, fontSize: 12 };
  const tooltipContentStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    color: theme.palette.text.primary,
    fontSize: 13,
    boxShadow: theme.shadows[8],
  };
  const tooltipLabelStyle = { color: theme.palette.text.primary, fontWeight: 600, marginBottom: 4 };
  const tooltipItemStyle = { color: theme.palette.text.secondary };
  const legendStyle = { color: theme.palette.text.secondary, fontSize: 12, paddingTop: 8 };
  const hasCityData = cityData.length > 0;
  const hasStatusData = statusData.some((entry) => Number(entry.value) > 0);
  const hasCancellationData = filteredCancellations.length > 0;

  if (loading) {
    return (
      <PageContainer maxWidth="content">
        <PageHeader
          overline="Gestão"
          title="Relatórios"
          subtitle="Receitas por cidade, distribuição de reservas por status e evolução de cancelamentos."
          icon={<Assessment />}
        />
        <PageLoading label="Carregando relatórios…" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="content">
        <PageHeader
          overline="Gestão"
          title="Relatórios"
          subtitle="Receitas por cidade, distribuição de reservas por status e evolução de cancelamentos."
          icon={<Assessment />}
        />
        <ErrorState
          title="Não foi possível carregar os relatórios"
          description="Ocorreu uma falha ao buscar os dados consolidados."
          onRetry={fetchReports}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="content" sx={{ '@media print': { px: 0, pt: 0 } }}>
      <PageHeader
        overline="Gestão"
        title="Relatórios"
        subtitle="Receitas por cidade, distribuição de reservas por status e evolução de cancelamentos."
        icon={<Assessment />}
        sx={{ '@media print': { display: 'none' } }}
        actions={
          <>
            <Button variant="outlined" startIcon={<Print />} onClick={handlePrint}>
              Imprimir
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => exportToCSV(cityData, 'receita_por_cidade.csv')}
            >
              Exportar CSV
            </Button>
          </>
        }
      />

      <SectionCard
        title="Filtros do relatório"
        subtitle="A janela escolhida afeta a evolução de cancelamentos e os indicadores do período."
        sx={{ mb: { xs: 2.5, md: 3 }, '@media print': { display: 'none' } }}
      >
        <DataToolbar sx={{ mb: 0 }}>
          <DataToolbarGroup>
            <TextField
              select
              size="small"
              label="Janela de análise"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
              sx={{ minWidth: 220, maxWidth: 260 }}
            >
              {PERIODO_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </DataToolbarGroup>
          <Typography variant="caption" color="textSecondary">
            {filteredCancellations.length}{' '}
            {filteredCancellations.length === 1 ? 'mês com registro' : 'meses com registro'} no
            período
          </Typography>
        </DataToolbar>
      </SectionCard>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, sm: 2.5 },
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          mb: { xs: 3, md: 4 },
        }}
      >
        <StatCard
          label="Receita total"
          value={formatCurrency(totals.receita)}
          icon={<AttachMoney />}
          tone="success"
          hint="Acumulado por cidade"
        />
        <StatCard
          label="Reservas"
          value={totals.reservas}
          icon={<BookOnline />}
          tone="primary"
          hint="Acumulado por cidade"
        />
        <StatCard
          label="Cancelamentos"
          value={totals.cancelamentos}
          icon={<Cancel />}
          tone="warning"
          hint={periodoLabel}
        />
        <StatCard
          label="Valor perdido"
          value={formatCurrency(totals.valorPerdido)}
          icon={<MoneyOff />}
          tone="error"
          hint={periodoLabel}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, lg: 3 },
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 8fr) minmax(0, 4fr)' },
          alignItems: 'stretch',
        }}
      >
        <SectionCard
          title="Faturamento por cidade"
          subtitle="Receita consolidada das reservas por cidade de origem."
        >
          {hasCityData ? (
            <Box sx={{ width: '100%', height: { xs: 300, md: 340 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="cidade" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis tickLine={false} axisLine={false} tick={axisTick} width={72} />
                  <RechartsTooltip
                    cursor={{ fill: theme.palette.action.hover }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Bar
                    name="Receita total"
                    dataKey="receita"
                    fill={theme.palette.primary.main}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <EmptyState
              compact
              title="Sem faturamento no período"
              description="Nenhuma reserva com receita registrada para montar o gráfico."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Reservas por status"
          subtitle="Distribuição atual das reservas na plataforma."
        >
          {hasStatusData ? (
            <Stack spacing={2}>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="value"
                      stroke={theme.palette.background.paper}
                      strokeWidth={2}
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name ?? index}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: any, _name: any, item: any) => [
                        `${value} reservas`,
                        statusLabel(item?.payload?.name ?? ''),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Stack spacing={1}>
                {statusData.map((entry, index) => (
                  <Box
                    key={entry.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: chartColors[index % chartColors.length],
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" color="textSecondary" noWrap>
                        {statusLabel(entry.name)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {entry.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          ) : (
            <EmptyState
              compact
              title="Sem reservas registradas"
              description="A distribuição por status aparece quando houver reservas na plataforma."
            />
          )}
        </SectionCard>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 3 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          alignItems: 'stretch',
          mt: { xs: 3, md: 4 },
        }}
      >
        <SectionCard
          title="Evolução de cancelamentos"
          subtitle="Quantidade de cancelamentos e valor perdido por mês."
        >
          {hasCancellationData ? (
            <Box sx={{ width: '100%', height: { xs: 300, md: 340 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={filteredCancellations}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="mesFormatado" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    width={48}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    width={64}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: any, name: any) =>
                      name === 'Valor perdido' ? formatCurrency(Number(value)) : value
                    }
                  />
                  <Legend wrapperStyle={legendStyle} iconType="plainline" />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    name="Cancelamentos"
                    dataKey="cancelamentos"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    name="Valor perdido"
                    dataKey="valorPerdido"
                    stroke={theme.palette.secondary.main}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <EmptyState
              compact
              title="Sem cancelamentos no período"
              description="Escolha outra janela de análise ou aguarde novos registros."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Performance por cidade"
          subtitle="Reservas e receita bruta consolidadas por cidade."
          noPadding
        >
          {hasCityData ? (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 360 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Cidade</TableCell>
                    <TableCell align="right">Reservas</TableCell>
                    <TableCell align="right">Receita bruta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cityData.map((row) => (
                    <TableRow key={row.cidade} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{row.cidade}</TableCell>
                      <TableCell align="right">{row.total_reservas}</TableCell>
                      <TableCell align="right">{formatCurrency(Number(row.receita || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState
              compact
              title="Sem dados por cidade"
              description="Nenhuma reserva registrada para montar a tabela de performance."
            />
          )}
        </SectionCard>
      </Box>
    </PageContainer>
  );
}
