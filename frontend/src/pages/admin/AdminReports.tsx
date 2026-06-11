import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Download, Print } from '@mui/icons-material';
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
import { reportsApi } from '../../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3'];

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [cityData, setCityData] = useState<any[]>([]);
  const [cancellationData, setCancellationData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [cityRes, cancelRes, statusRes] = await Promise.all([
        reportsApi.byCity(),
        reportsApi.cancellations(),
        reportsApi.byStatus(),
      ]);

      setCityData(cityRes.data.data || []);

      const formattedCancel = (cancelRes.data.data || []).map((c: any) => ({
        ...c,
        mesFormatado: new Date(c.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valorPerdido: Number(c.valor_perdido || 0),
        cancelamentos: Number(c.cancelamentos || 0),
      })).reverse();
      setCancellationData(formattedCancel);

      const formattedStatus = (statusRes.data.data || []).map((s: any) => ({
        name: s.status,
        value: s._count?.id || 0,
        receita: Number(s._sum?.valorTotal || 0),
      }));
      setStatusData(formattedStatus);

    } catch (error) {
      console.error(error);
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
      const values = headers.map(header => {
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1400, margin: '0 auto', '@media print': { p: 0 } }}>
      {/* Title & Actions */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          '@media print': { display: 'none' },
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Relatórios Consolidados
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Métricas de ocupação, cancelamentos, receitas por região e taxas de conversão.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Print />}
            onClick={handlePrint}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
          >
            Imprimir Relatório
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Download />}
            onClick={() => exportToCSV(cityData, 'receita_por_cidade.csv')}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            Exportar CSV
          </Button>
        </Stack>
      </Box>

      {/* Grid structure for charts */}
      <Grid container spacing={4}>
        {/* Chart 1: Revenue by City */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
              Faturamento Consolidado por Cidade
            </Typography>
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="cidade" tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    formatter={(value: any) =>
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
                    }
                  />
                  <Legend />
                  <Bar name="Receita Total" dataKey="receita" fill="#0097A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Chart 2: Status Distribution */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
              Reservas por Status
            </Typography>
            <Box sx={{ height: 260, position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Stack spacing={1} sx={{ mt: 2, flex: 1, justifyContent: 'center' }}>
              {statusData.map((entry, index) => (
                <Box key={entry.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length] }} />
                    <Typography variant="body2" color="text.secondary">{entry.name}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.value} reservas</Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Chart 3: Cancellations Trend */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
              Evolução Mensal de Cancelamentos
            </Typography>
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cancellationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mesFormatado" tickLine={false} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    name="Qtd. Cancelamentos"
                    dataKey="cancelamentos"
                    stroke="#FF7043"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    name="Valor Perdido (R$)"
                    dataKey="valorPerdido"
                    stroke="#FF3D00"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Table representation: Performance Table */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, mb: 3 }}>
              Tabela de Performance por Região
            </Typography>
            <TableContainer sx={{ flex: 1 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Cidade</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Reservas</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Receita Bruta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cityData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Nenhum dado disponível.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cityData.map((row) => (
                      <TableRow key={row.cidade} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{row.cidade}</TableCell>
                        <TableCell align="right">{row.total_reservas}</TableCell>
                        <TableCell align="right">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.receita || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
