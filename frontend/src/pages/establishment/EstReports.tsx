import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Assessment, AttachMoney, Hotel, Refresh, TaskAlt, TrendingUp } from '@mui/icons-material';
import { establishmentsApi, reportsApi } from '../../services/api';
import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
  StatusChip,
  TableSkeleton,
} from '../../components/common';
import { formatCurrency } from '../../theme/tokens';

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

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Relatório operacional do estabelecimento (somente leitura).
 * Consome `reports/occupancy` e `reports/reservas/by-status` — nenhum cálculo
 * de indicador é feito no cliente além de formatação.
 */
export default function EstReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [establishmentId, setEstablishmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [statusData, setStatusData] = useState<StatusSummary[]>([]);

  const loadEstablishment = useCallback(async () => {
    try {
      const res = await establishmentsApi.getMy();
      const list = res.data.data || res.data || [];
      if (list[0]?.id) {
        setEstablishmentId(list[0].id);
        return list[0].id as string;
      }
    } catch (err) {
      console.error('Erro ao carregar estabelecimento', err);
    }
    return null;
  }, []);

  const load = useCallback(
    async (estId?: string) => {
      setLoading(true);
      setError(false);
      try {
        const id = estId || establishmentId || (await loadEstablishment());
        if (!id) {
          setError(true);
          return;
        }

        const [occRes, statusRes] = await Promise.allSettled([
          reportsApi.occupancy(id, month + 1, year),
          reportsApi.byStatus(id),
        ]);

        if (occRes.status === 'fulfilled') {
          setOccupancy(occRes.value.data.data || occRes.value.data || null);
        } else {
          console.error('Erro ao carregar ocupação', occRes.reason);
          setOccupancy(null);
        }

        if (statusRes.status === 'fulfilled') {
          setStatusData(statusRes.value.data.data || statusRes.value.data || []);
        } else {
          console.error('Erro ao carregar status', statusRes.reason);
          setStatusData([]);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [establishmentId, loadEstablishment, month, year],
  );

  useEffect(() => {
    load();
    // Recarrega quando muda o período selecionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const taxa = occupancy?.taxaOcupacao ? String(occupancy.taxaOcupacao) : '—';
  const taxaFormatada = taxa.includes('%') || taxa === '—' ? taxa : `${taxa}%`;
  const totalReservas = statusData.reduce((acc, item) => acc + (item._count?.id || 0), 0);

  return (
    <PageContainer>
      <PageHeader
        overline="Gestão"
        title="Relatórios"
        subtitle="Ocupação, distribuição de reservas e faturamento estimado do estabelecimento."
        actions={
          <>
            <TextField
              select
              size="small"
              label="Mês"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              sx={{ minWidth: 148 }}
            >
              {MONTHS.map((name, index) => (
                <MenuItem key={name} value={index}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Ano"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              sx={{ minWidth: 110 }}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => load()}>
              Atualizar
            </Button>
          </>
        }
      />

      {error ? (
        <SectionCard>
          <ErrorState
            onRetry={() => load()}
            description="Não foi possível carregar os relatórios do estabelecimento. Verifique a conexão e tente novamente."
          />
        </SectionCard>
      ) : loading ? (
        <SectionCard>
          <TableSkeleton rows={5} columns={4} />
        </SectionCard>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Taxa de ocupação"
              value={taxaFormatada}
              icon={<TrendingUp />}
              tone="primary"
              hint={`${occupancy?.diasOcupados ?? 0} de ${occupancy?.totalDias ?? 0} dias`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Quartos"
              value={occupancy?.totalQuartos ?? '—'}
              icon={<Hotel />}
              tone="info"
              hint="Quartos considerados no período"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Reservas no período"
              value={totalReservas}
              icon={<TaskAlt />}
              tone="secondary"
              hint={`${occupancy?.reservasConfirmadas ?? 0} confirmadas · ${occupancy?.reservasFinalizadas ?? 0} finalizadas`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Faturamento estimado"
              value={formatCurrency(Number(occupancy?.faturamentoEstimado || 0))}
              icon={<AttachMoney />}
              tone="success"
              hint="Baseado nas reservas do período"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionCard
              title="Reservas por status"
              subtitle="Distribuição das reservas do estabelecimento e soma dos valores."
              noPadding={statusData.length > 0}
            >
              {statusData.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Assessment />}
                  title="Sem reservas registradas"
                  description="Quando houver reservas no estabelecimento, a distribuição por status aparece aqui."
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Reservas</TableCell>
                        <TableCell align="right">Valor somado</TableCell>
                        <TableCell align="right">Participação</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statusData.map((row) => {
                        const count = row._count?.id || 0;
                        const share = totalReservas > 0 ? Math.round((count / totalReservas) * 100) : 0;
                        return (
                          <TableRow key={row.status} hover>
                            <TableCell>
                              <StatusChip status={row.status} />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {count}
                            </TableCell>
                            <TableCell align="right">{formatCurrency(Number(row._sum?.valorTotal || 0))}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                <Box
                                  sx={{
                                    width: 64,
                                    height: 6,
                                    borderRadius: 999,
                                    bgcolor: 'action.hover',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: `${share}%`,
                                      height: '100%',
                                      bgcolor: 'primary.main',
                                      borderRadius: 999,
                                    }}
                                  />
                                </Box>
                                <Typography variant="caption" color="textSecondary" sx={{ minWidth: 32, textAlign: 'right' }}>
                                  {share}%
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </SectionCard>
          </Grid>
        </Grid>
      )}
    </PageContainer>
  );
}
