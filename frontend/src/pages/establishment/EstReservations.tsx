import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  CircularProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tab,
  Tabs,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Check,
  Close,
  Visibility,
  CalendarMonth,
  AttachMoney,
  People,
  Info,
  PictureAsPdf,
  OpenInNew,
  WarningAmber,
  Phone,
  Email,
  Timer,
  CancelOutlined,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { establishmentsApi, reservationsApi, paymentsApi, reportsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

interface Establishment {
  id: string;
  nome: string;
  proprietarioId: string;
}

interface Hospede {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
}

interface Quarto {
  id: string;
  nome: string;
  capacidade: number;
}

interface Payment {
  id: string;
  reservaId: string;
  codigoTransacao?: string;
  metodo: 'PIX' | 'CARTAO' | 'BOLETO';
  comprovanteUrl?: string;
  valor: number | string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'ESTORNADO' | 'CANCELADO';
  criadoEm: string;
}

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
  cancelamentoMotivo?: string;
  criadoEm: string;
  hospede: Hospede;
  quarto: Quarto;
  pagamento?: Payment | null;
}

const statusMap = {
  SOLICITADA: { label: 'Solicitada', color: 'info' as const, bg: 'rgba(2, 136, 209, 0.08)', text: '#0288d1' },
  CONFIRMADA: { label: 'Confirmada / Agrade Pagto', color: 'warning' as const, bg: 'rgba(237, 108, 2, 0.08)', text: '#ed6c02' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando Pagamento', color: 'warning' as const, bg: 'rgba(237, 108, 2, 0.08)', text: '#ed6c02' },
  FINALIZADA: { label: 'Finalizada', color: 'success' as const, bg: 'rgba(46, 125, 50, 0.08)', text: '#2e7d32' },
  CANCELADA: { label: 'Cancelada', color: 'error' as const, bg: 'rgba(211, 47, 47, 0.08)', text: '#d32f2f' },
};

export default function EstReservations() {
  const { user } = useAuthStore();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

  // Reservation list states
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination states
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter state
  const [activeTab, setActiveTab] = useState(0); // 0: Solicitadas, 1: Aguardando Pagamento, 2: Finalizadas, 3: Canceladas, 4: Todas

  // Dashboard stats (independent of active tab)
  const [stats, setStats] = useState({ pendingCount: 0, awaitingPaymentCount: 0, finalizedCount: 0, totalRevenue: '0.00' });

  // Details Dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Cancel Dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        // Fetch establishments
        let userEsts: Establishment[] = [];
        try {
          const estsRes = await establishmentsApi.getMy();
          userEsts = estsRes.data.data || estsRes.data || [];
        } catch (err) {
          console.error('Erro ao carregar estabelecimentos do proprietário.', err);
        }

        // If sub-user has a linked establishment, fetch it
        const linkedEstId = (user as any)?.estabelecimentoVinculadoId;
        if (userEsts.length === 0 && linkedEstId) {
          try {
            const singleEstRes = await establishmentsApi.getOne(linkedEstId);
            const singleEst = singleEstRes.data.data || singleEstRes.data;
            if (singleEst) {
              userEsts = [singleEst];
            }
          } catch (err) {
            console.error('Erro ao carregar estabelecimento vinculado do sub-usuario.', err);
          }
        }

        setEstablishments(userEsts);

        if (userEsts.length > 0) {
          setSelectedEstablishment(userEsts[0]);
        }
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar dados iniciais');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Fetch reservations based on filters, page, rowsPerPage, and active tab
  const fetchReservations = async () => {
    if (!selectedEstablishment) return;
    try {
      setListLoading(true);

      // Map active tab to status filter
      let statusFilter: string | undefined;
      switch (activeTab) {
        case 0:
          statusFilter = 'SOLICITADA';
          break;
        case 1:
          // In backend, "Aguardando Pagamento" could be represented by CONFIRMADA or AGUARDANDO_PAGAMENTO
          // We'll fetch all and filter in frontend or request specifically. Let's see:
          // The API takes a single status. We will query CONFIRMADA first.
          // Wait, to handle CONFIRMADA and AGUARDANDO_PAGAMENTO together:
          // We can fetch all and filter on frontend, or if pagination is needed, query both.
          // Since we query by activeTab, let's fetch based on tab.
          // We will fetch CONFIRMADA for Tab 1, but wait!
          // If the guest pays, the status changes to AGUARDANDO_PAGAMENTO.
          // Let's fetch all and filter them in the client if we want to combine, or fetch specifically.
          // Let's fetch all (no status filter) if tab is 'All' or 'Aguardando Pagamento' and filter on client to ensure we don't miss anything,
          // or we can handle it dynamically. Let's fetch all if tab is 1 and filter locally, or request without status and filter.
          // Wait, if there are many reservations, local filtering on a single page of 'all' is fine.
          // Let's check how many total records there are. Usually small for local test.
          // Let's query without status filter if tab is 1 or 4, and filter locally. That is extremely robust!
          statusFilter = undefined; 
          break;
        case 2:
          statusFilter = 'FINALIZADA';
          break;
        case 3:
          statusFilter = 'CANCELADA';
          break;
        case 4:
        default:
          statusFilter = undefined;
          break;
      }

      const res = await reservationsApi.getAll({
        estabelecimentoId: selectedEstablishment.id,
        status: statusFilter,
        page: page + 1, // backend is 1-indexed
        limit: rowsPerPage,
      });

      const resData = res.data.data?.data || res.data.data || res.data || [];
      const total = res.data.data?.total || resData.length;

      // Filter locally for Tab 1 (Aguardando Pagamento: should be CONFIRMADA or AGUARDANDO_PAGAMENTO)
      if (activeTab === 1) {
        const filtered = resData.filter(
          (r: Reservation) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO'
        );
        setReservations(filtered);
        setTotalCount(filtered.length);
      } else {
        setReservations(resData);
        setTotalCount(total);
      }
      fetchStats();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar reservas');
    } finally {
      setListLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedEstablishment) return;
    try {
      const res = await reportsApi.byStatus(selectedEstablishment.id);
      const data: { status: string; _count: { id: number }; _sum: { valorTotal: string | number } }[] = res.data.data || res.data || [];
      const pendingCount = data.find((d) => d.status === 'SOLICITADA')?._count?.id ?? 0;
      const awaitingPaymentCount =
        (data.find((d) => d.status === 'CONFIRMADA')?._count?.id ?? 0) +
        (data.find((d) => d.status === 'AGUARDANDO_PAGAMENTO')?._count?.id ?? 0);
      const finalizedCount = data.find((d) => d.status === 'FINALIZADA')?._count?.id ?? 0;
      const totalRevenue = data
        .filter((d) => d.status === 'FINALIZADA')
        .reduce((sum, d) => sum + Number(d._sum.valorTotal ?? 0), 0)
        .toFixed(2);
      setStats({ pendingCount, awaitingPaymentCount, finalizedCount, totalRevenue });
    } catch (error) {
      console.error('Erro ao carregar indicadores', error);
    }
  };

  useEffect(() => {
    if (selectedEstablishment) {
      fetchReservations();
    }
  }, [selectedEstablishment, page, rowsPerPage, activeTab]);

  const handleEstablishmentChange = (estId: string) => {
    const est = establishments.find((e) => e.id === estId) || null;
    setSelectedEstablishment(est);
    setPage(0);
  };

  const handleChangePage = (_: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Confirm reservation request
  const handleConfirmReservation = async (reservationId: string) => {
    try {
      setActionLoading(true);
      await reservationsApi.confirm(reservationId);
      toast.success('Reserva confirmada! Hóspede notificado para realizar o pagamento.');
      fetchReservations();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao confirmar reserva');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Cancel Dialog
  const handleOpenCancel = (reservation: Reservation) => {
    setReservationToCancel(reservation);
    setCancelReason('');
    setCancelOpen(true);
  };

  // Confirm cancel reservation
  const handleConfirmCancel = async () => {
    if (!reservationToCancel) return;
    try {
      setActionLoading(true);
      await reservationsApi.cancel(reservationToCancel.id, { motivo: cancelReason });
      toast.success('Reserva cancelada com sucesso.');
      setCancelOpen(false);
      setReservationToCancel(null);
      fetchReservations();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao cancelar reserva');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Details Dialog and load payment information
  const handleOpenDetails = async (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailedPayment(reservation.pagamento || null);
    setDetailsOpen(true);

    // Fetch up-to-date payment status
    try {
      setPaymentLoading(true);
      const res = await paymentsApi.getByReservation(reservation.id);
      const pData = res.data.data || res.data;
      if (pData) {
        setDetailedPayment(pData);
      }
    } catch (err) {
      console.error('Erro ao buscar pagamento da reserva, usando objeto interno.', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirm payment & Finalize reservation
  const handleConfirmPayment = async (reserva: Reservation) => {
    try {
      setActionLoading(true);

      // If there is an associated payment in PENDENTE state, confirm it first
      if (detailedPayment && detailedPayment.status === 'PENDENTE') {
        await paymentsApi.confirm(detailedPayment.id);
      }

      // Finalize the reservation
      await reservationsApi.finalize(reserva.id);
      
      toast.success('Pagamento confirmado e reserva finalizada com sucesso! 🎉');
      setDetailsOpen(false);
      fetchReservations();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao confirmar pagamento');
    } finally {
      setActionLoading(false);
    }
  };

  // Dashboard stats computed from /reports/reservas/by-status (independent of active tab)
  const { pendingCount, awaitingPaymentCount, finalizedCount, totalRevenue } = stats;

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Gerenciar Reservas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualize as solicitações de reserva de hóspedes, gerencie confirmações e aprove comprovantes de pagamentos.
          </Typography>
        </Box>

        {establishments.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="est-select-label">Estabelecimento</InputLabel>
            <Select
              labelId="est-select-label"
              value={selectedEstablishment?.id || ''}
              label="Estabelecimento"
              onChange={(e) => handleEstablishmentChange(e.target.value)}
              sx={{ borderRadius: '10px' }}
            >
              {establishments.map((est) => (
                <MenuItem key={est.id} value={est.id}>
                  {est.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Quick Stats Panel */}
      {selectedEstablishment && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(2, 136, 209, 0.08)', borderRadius: '12px', color: '#0288d1' }}>
                <Timer />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Solicitações Pendentes
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {pendingCount}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(237, 108, 2, 0.08)', borderRadius: '12px', color: '#ed6c02' }}>
                <CalendarMonth />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Aguardando Pagamento
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {awaitingPaymentCount}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(46, 125, 50, 0.08)', borderRadius: '12px', color: '#2e7d32' }}>
                <CheckCircleOutlined />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Estadias Concluídas
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {finalizedCount}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(0, 151, 167, 0.08)', borderRadius: '12px', color: '#0097A7' }}>
                <AttachMoney />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Faturamento Concluído
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  R$ {totalRevenue}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tabs Filter Section */}
      <Paper sx={{ borderRadius: '16px', mb: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => {
            setActiveTab(val);
            setPage(0);
          }}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab label="Solicitações" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Aguardando Pagamento" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Finalizadas" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Canceladas" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Todas" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {/* Tabela de Listagem */}
      {listLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !selectedEstablishment ? (
        <Paper sx={{ p: 6, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Typography color="text.secondary">Nenhum estabelecimento selecionado.</Typography>
        </Paper>
      ) : reservations.length === 0 ? (
        <Paper sx={{ p: 8, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <CalendarMonth sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Nenhuma reserva nesta categoria
          </Typography>
          <Typography color="text.secondary">
            Não há registros de reserva correspondentes a este filtro no momento.
          </Typography>
        </Paper>
      ) : (
        <Paper
          sx={{
            borderRadius: '20px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.015)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Hóspede</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Quarto</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Período</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Valor Total</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reservations.map((reserva) => {
                  const statusInfo = statusMap[reserva.status] || { label: reserva.status, color: 'default', bg: 'rgba(0,0,0,0.04)', text: '#333' };
                  const nights = dayjs(reserva.checkOut).diff(dayjs(reserva.checkIn), 'day');

                  return (
                    <TableRow key={reserva.id} hover>
                      <TableCell>
                        <Chip
                          label={reserva.codigoReserva}
                          size="small"
                          sx={{
                            fontFamily: '"Outfit", sans-serif',
                            fontWeight: 700,
                            bgcolor: 'rgba(0, 151, 167, 0.08)',
                            color: '#0097A7',
                            borderRadius: '6px',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {reserva.hospede?.nome}
                        <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                          {reserva.hospede?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{reserva.quarto?.nome}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {dayjs(reserva.checkIn).format('DD/MM/YYYY')} a {dayjs(reserva.checkOut).format('DD/MM/YYYY')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({nights} {nights === 1 ? 'noite' : 'noites'}, {reserva.adultos} Adt {reserva.criancas > 0 && `, ${reserva.criancas} Crianças`})
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} color="primary.main">
                        R$ {Number(reserva.valorTotal).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusInfo.label}
                          size="small"
                          sx={{
                            bgcolor: statusInfo.bg,
                            color: statusInfo.text,
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          {reserva.status === 'SOLICITADA' && (
                            <>
                              <Tooltip title="Confirmar Reserva">
                                <IconButton
                                  onClick={() => handleConfirmReservation(reserva.id)}
                                  color="success"
                                  size="small"
                                  disabled={actionLoading}
                                >
                                  <Check />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Recusar Reserva">
                                <IconButton
                                  onClick={() => handleOpenCancel(reserva)}
                                  color="error"
                                  size="small"
                                  disabled={actionLoading}
                                >
                                  <Close />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}

                          {(reserva.status === 'CONFIRMADA' || reserva.status === 'AGUARDANDO_PAGAMENTO') && (
                            <>
                              {reserva.pagamento?.comprovanteUrl && (
                                <Tooltip title="Confirmar Pagamento e Finalizar">
                                  <IconButton
                                    onClick={() => handleOpenDetails(reserva)}
                                    color="success"
                                    size="small"
                                    disabled={actionLoading}
                                  >
                                    <CheckCircleOutlined />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Cancelar Reserva">
                                <IconButton
                                  onClick={() => handleOpenCancel(reserva)}
                                  color="error"
                                  size="small"
                                  disabled={actionLoading}
                                >
                                  <CancelOutlined />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}

                          <Tooltip title="Visualizar Detalhes">
                            <IconButton
                              onClick={() => handleOpenDetails(reserva)}
                              color="primary"
                              size="small"
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`}
          />
        </Paper>
      )}

      {/* Cancel Reservation Dialog */}
      <Dialog
        open={cancelOpen}
        onClose={() => !actionLoading && setCancelOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber sx={{ color: 'error.main' }} />
          Justificativa de Cancelamento
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Informe o motivo do cancelamento da reserva <strong>{reservationToCancel?.codigoReserva}</strong>. O hóspede será notificado por e-mail.
          </DialogContentText>
          <TextField
            label="Motivo do Cancelamento"
            fullWidth
            required
            multiline
            rows={3}
            disabled={actionLoading}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex: Não identificamos o pagamento no prazo estabelecido."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setCancelOpen(false)} disabled={actionLoading} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmCancel}
            disabled={actionLoading || !cancelReason}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {actionLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detailed Reservation Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
          Detalhes da Reserva: {selectedReservation?.codigoReserva}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          {selectedReservation && (
            <Grid container spacing={4}>
              {/* Left Column: Reservation Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Dados da Estadia
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Status:</Typography>
                    <Chip
                      label={selectedReservation.status}
                      size="small"
                      color={statusMap[selectedReservation.status]?.color || 'default'}
                      sx={{ fontWeight: 600, height: 20 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Quarto reservado:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedReservation.quarto?.nome}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Check-In:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(selectedReservation.checkIn).format('DD/MM/YYYY')}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Check-Out:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayjs(selectedReservation.checkOut).format('DD/MM/YYYY')}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Acompanhantes:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedReservation.adultos} {selectedReservation.adultos === 1 ? 'Adulto' : 'Adultos'}
                      {selectedReservation.criancas > 0 && ` e ${selectedReservation.criancas} ${selectedReservation.criancas === 1 ? 'Criança' : 'Crianças'}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed', borderColor: 'divider', pt: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>Valor Total:</Typography>
                    <Typography variant="body1" color="primary.main" sx={{ fontWeight: 800 }}>
                      R$ {Number(selectedReservation.valorTotal).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>

                {selectedReservation.observacoes && (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(0,0,0,0.015)', borderRadius: '10px', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                      Observações do hóspede:
                    </Typography>
                    <Typography variant="body2">
                      {selectedReservation.observacoes}
                    </Typography>
                  </Box>
                )}

                {selectedReservation.cancelamentoMotivo && (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(211, 47, 47, 0.04)', borderRadius: '10px', border: '1px solid', borderColor: 'rgba(211, 47, 47, 0.2)' }}>
                    <Typography variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                      Motivo do Cancelamento:
                    </Typography>
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                      {selectedReservation.cancelamentoMotivo}
                    </Typography>
                  </Box>
                )}
              </Grid>

              {/* Right Column: Guest Info & Payment Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Dados do Hóspede
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px', mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'rgba(0, 151, 167, 0.08)', color: '#0097A7', fontWeight: 700 }}>
                      {selectedReservation.hospede?.nome.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {selectedReservation.hospede?.nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        ID Hóspede: {selectedReservation.hospede?.id}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" component="a" href={`mailto:${selectedReservation.hospede?.email}`} sx={{ color: 'primary.main', textDecoration: 'none' }}>
                        {selectedReservation.hospede?.email}
                      </Typography>
                    </Box>
                    {selectedReservation.hospede?.telefone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" component="a" href={`tel:${selectedReservation.hospede?.telefone}`} sx={{ color: 'text.primary', textDecoration: 'none' }}>
                          {selectedReservation.hospede?.telefone}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>

                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Informações de Pagamento
                </Typography>
                
                {paymentLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : !detailedPayment ? (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.01)', borderStyle: 'dashed', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum pagamento registrado para esta reserva.
                    </Typography>
                  </Paper>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Método:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{detailedPayment.metodo}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Valor do Pagamento:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>R$ {Number(detailedPayment.valor).toFixed(2)}</Typography>
                      </Box>
                      {detailedPayment.codigoTransacao && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Transação:</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{detailedPayment.codigoTransacao}</Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Status do Pagamento:</Typography>
                        <Chip
                          label={detailedPayment.status}
                          size="small"
                          color={detailedPayment.status === 'CONFIRMADO' ? 'success' : 'warning'}
                          sx={{ fontWeight: 600, height: 18, fontSize: '0.65rem' }}
                        />
                      </Box>

                      {detailedPayment.comprovanteUrl && (
                        <Box sx={{ mt: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            Comprovante Anexado:
                          </Typography>
                          
                          <Button
                            variant="outlined"
                            startIcon={<PictureAsPdf />}
                            endIcon={<OpenInNew />}
                            component="a"
                            href={detailedPayment.comprovanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            fullWidth
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              justifyContent: 'space-between',
                              borderColor: 'divider',
                              color: 'text.primary',
                              '&:hover': {
                                bgcolor: 'rgba(0,151,167,0.04)',
                                borderColor: 'primary.main',
                              }
                            }}
                          >
                            Visualizar Comprovante
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
          <Button onClick={() => setDetailsOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Fechar
          </Button>

          {selectedReservation && selectedReservation.status === 'SOLICITADA' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  setDetailsOpen(false);
                  handleOpenCancel(selectedReservation);
                }}
                disabled={actionLoading}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
              >
                Recusar Reserva
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setDetailsOpen(false);
                  handleConfirmReservation(selectedReservation.id);
                }}
                disabled={actionLoading}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                }}
              >
                Confirmar Reserva
              </Button>
            </Box>
          )}

          {selectedReservation && 
            (selectedReservation.status === 'CONFIRMADA' || selectedReservation.status === 'AGUARDANDO_PAGAMENTO') && 
            detailedPayment?.comprovanteUrl && (
              <Button
                variant="contained"
                color="success"
                onClick={() => handleConfirmPayment(selectedReservation)}
                disabled={actionLoading}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: 'success.main',
                  '&:hover': {
                    bgcolor: 'success.dark',
                  }
                }}
              >
                {actionLoading ? 'Finalizando...' : 'Aprovar Pagamento e Finalizar'}
              </Button>
            )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
