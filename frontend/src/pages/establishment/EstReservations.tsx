import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AttachMoney,
  CalendarMonth,
  CancelOutlined,
  Check,
  CheckCircleOutlined,
  Close,
  Email,
  Hotel,
  OpenInNew,
  Phone,
  PictureAsPdf,
  Receipt,
  Refresh,
  Timer,
  Visibility,
} from '@mui/icons-material';
import {
  ConfirmDialog,
  DataToolbar,
  DataToolbarGroup,
  EmptySearchIcon,
  EmptyState,
  ErrorState,
  FormError,
  InfoGrid,
  InfoItem,
  InlineLoading,
  ModoPagamentoChip,
  PageContainer,
  PageHeader,
  SearchField,
  SectionCard,
  StatCard,
  StatusChip,
  TableSkeleton,
} from '../../components/common';
import { formatCurrency, formatDate, radius } from '../../theme/tokens';
import { establishmentsApi, reservationsApi, paymentsApi, reportsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

interface Establishment {
  id: string;
  nome: string;
  proprietarioId: string;
  modoPagamento?: 'PADRAO' | 'MERCADO_PAGO';
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
  /** Snapshot do modo de pagamento no momento da criação da reserva */
  modoPagamento?: 'PADRAO' | 'MERCADO_PAGO';
  observacoes?: string;
  cancelamentoMotivo?: string;
  criadoEm: string;
  hospede: Hospede;
  quarto: Quarto;
  pagamento?: Payment | null;
}

/** Rótulos de status de pagamento (o backend usa CONFIRMADO, o design system APROVADO). */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  ESTORNADO: 'Estornado',
  CANCELADO: 'Cancelado',
  EM_ANALISE: 'Em análise',
  PROCESSANDO: 'Processando',
};

/** Rótulos amigáveis da forma de pagamento escolhida pelo hóspede. */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CARTAO: 'Cartão de crédito',
  BOLETO: 'Boleto bancário',
};

const paymentMethodLabel = (metodo?: string | null) =>
  metodo ? (PAYMENT_METHOD_LABEL[metodo] ?? metodo) : 'Ainda não escolhida';

/** Mapeia o status de pagamento para o tom semântico do design system. */
const paymentChipStatus = (status: string) => (status === 'CONFIRMADO' ? 'APROVADO' : status);

const nightsBetween = (checkIn: string, checkOut: string) =>
  dayjs(checkOut).diff(dayjs(checkIn), 'day');

export default function EstReservations() {
  const { user } = useAuthStore();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

  // Reservation list states
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination states
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter state
  const [activeTab, setActiveTab] = useState(0); // 0: Solicitadas, 1: Aguardando Pagamento, 2: Finalizadas, 3: Canceladas, 4: Todas
  const [search, setSearch] = useState('');

  // Filtro por data (opcional). Padrão: sem filtro, lista todas as reservas.
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [campoData, setCampoData] = useState<'estadia' | 'solicitacao'>('estadia');

  // Dashboard stats (independent of active tab)
  const [stats, setStats] = useState({
    pendingCount: 0,
    awaitingPaymentCount: 0,
    finalizedCount: 0,
    totalRevenue: '0.00',
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Details Dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Cancel Dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState(false);

  // Confirm / Finalize Dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reservationToConfirm, setReservationToConfirm] = useState<Reservation | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reservationToFinalize, setReservationToFinalize] = useState<Reservation | null>(null);

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
      setListError(null);

      // Map active tab to status filter
      let statusFilter: string | undefined;
      switch (activeTab) {
        case 0:
          statusFilter = 'SOLICITADA';
          break;
        case 1:
          // "Aguardando pagamento" agrupa CONFIRMADA e AGUARDANDO_PAGAMENTO: a API
          // aceita um único status, então busca sem filtro e refina no cliente.
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
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        campoData: dataInicio || dataFim ? campoData : undefined,
        page: page + 1, // backend is 1-indexed
        limit: rowsPerPage,
      });

      const resData = res.data.data?.data || res.data.data || res.data || [];
      const total = res.data.data?.total || resData.length;

      // Filter locally for Tab 1 (Aguardando Pagamento: should be CONFIRMADA or AGUARDANDO_PAGAMENTO)
      if (activeTab === 1) {
        const filtered = resData.filter(
          (r: Reservation) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO',
        );
        setReservations(filtered);
        setTotalCount(filtered.length);
      } else {
        setReservations(resData);
        setTotalCount(total);
      }
      fetchStats();
    } catch (error: any) {
      console.error(error);
      setListError(
        error.response?.data?.message || 'Não foi possível carregar as reservas. Tente novamente.',
      );
      toast.error('Erro ao buscar reservas');
    } finally {
      setListLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedEstablishment) return;
    try {
      const res = await reportsApi.byStatus(selectedEstablishment.id);
      const data: { status: string; _count: { id: number }; _sum: { valorTotal: string | number } }[] =
        res.data.data || res.data || [];
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
    } finally {
      setStatsLoaded(true);
    }
  };

  useEffect(() => {
    if (selectedEstablishment) {
      fetchReservations();
    }
  }, [selectedEstablishment, page, rowsPerPage, activeTab, dataInicio, dataFim, campoData]);

  const handleEstablishmentChange = (estId: string) => {
    const est = establishments.find((e) => e.id === estId) || null;
    setSelectedEstablishment(est);
    setPage(0);
    setSearch('');
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
      toast.success('Reserva confirmada. Hóspede notificado para realizar o pagamento.');
      fetchReservations();
      return true;
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao confirmar reserva');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestConfirm = (reservation: Reservation) => {
    setReservationToConfirm(reservation);
    setConfirmOpen(true);
  };

  const handleSubmitConfirm = async () => {
    if (!reservationToConfirm) return;
    const ok = await handleConfirmReservation(reservationToConfirm.id);
    if (ok) {
      setConfirmOpen(false);
      setReservationToConfirm(null);
    }
  };

  // Open Cancel Dialog
  const handleOpenCancel = (reservation: Reservation) => {
    setReservationToCancel(reservation);
    setCancelReason('');
    setCancelError(false);
    setCancelOpen(true);
  };

  // Confirm cancel reservation
  const handleConfirmCancel = async () => {
    if (!reservationToCancel) return;
    // O motivo é obrigatório na interface — mantém a regra anterior (botão desabilitado).
    if (!cancelReason.trim()) {
      setCancelError(true);
      return;
    }
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

      toast.success('Pagamento confirmado e reserva finalizada com sucesso.');
      setDetailsOpen(false);
      fetchReservations();
      return true;
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao confirmar pagamento');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestFinalize = () => {
    if (!selectedReservation) return;
    setReservationToFinalize(selectedReservation);
    setDetailsOpen(false);
    setFinalizeOpen(true);
  };

  const handleSubmitFinalize = async () => {
    if (!reservationToFinalize) return;
    const ok = await handleConfirmPayment(reservationToFinalize);
    if (ok) {
      setFinalizeOpen(false);
      setReservationToFinalize(null);
    }
  };

  // Dashboard stats computed from /reports/reservas/by-status (independent of active tab)
  const { pendingCount, awaitingPaymentCount, finalizedCount, totalRevenue } = stats;

  const isMpEstabelecimento =
    (selectedReservation?.modoPagamento ?? selectedEstablishment?.modoPagamento) === 'MERCADO_PAGO';

  /** Busca restrita aos registros já carregados (a API de reservas não expõe parâmetro de busca). */
  const visibleReservations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reservations;
    return reservations.filter((reserva) =>
      [reserva.codigoReserva, reserva.hospede?.nome, reserva.hospede?.email, reserva.quarto?.nome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [reservations, search]);

  const detailsNights = selectedReservation
    ? nightsBetween(selectedReservation.checkIn, selectedReservation.checkOut)
    : 0;

  /** Ações por status — mesma matriz de permissões da versão anterior. */
  const renderReservationActions = (reserva: Reservation) => (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ justifyContent: { xs: 'flex-end', sm: 'center' }, flexWrap: 'nowrap' }}
    >
      {reserva.status === 'SOLICITADA' && (
        <>
          <Tooltip title="Confirmar reserva">
            <IconButton
              onClick={() => handleRequestConfirm(reserva)}
              color="success"
              size="small"
              disabled={actionLoading}
              aria-label={`Confirmar reserva ${reserva.codigoReserva}`}
            >
              <Check fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Recusar reserva">
            <IconButton
              onClick={() => handleOpenCancel(reserva)}
              color="error"
              size="small"
              disabled={actionLoading}
              aria-label={`Recusar reserva ${reserva.codigoReserva}`}
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      {(reserva.status === 'CONFIRMADA' || reserva.status === 'AGUARDANDO_PAGAMENTO') && (
        <>
          {reserva.pagamento?.comprovanteUrl && !isMpEstabelecimento && (
            <Tooltip title="Confirmar pagamento e finalizar">
              <IconButton
                onClick={() => handleOpenDetails(reserva)}
                color="success"
                size="small"
                disabled={actionLoading}
                aria-label={`Confirmar pagamento da reserva ${reserva.codigoReserva}`}
              >
                <CheckCircleOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Cancelar reserva">
            <IconButton
              onClick={() => handleOpenCancel(reserva)}
              color="error"
              size="small"
              disabled={actionLoading}
              aria-label={`Cancelar reserva ${reserva.codigoReserva}`}
            >
              <CancelOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      <Tooltip title="Ver detalhes">
        <IconButton
          onClick={() => handleOpenDetails(reserva)}
          color="primary"
          size="small"
          aria-label={`Ver detalhes da reserva ${reserva.codigoReserva}`}
        >
          <Visibility fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderList = () => {
    if (listLoading) {
      return (
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <TableSkeleton rows={rowsPerPage > 8 ? 8 : rowsPerPage} columns={6} />
        </Box>
      );
    }

    if (listError) {
      return <ErrorState title="Não foi possível carregar as reservas" description={listError} onRetry={fetchReservations} />;
    }

    if (visibleReservations.length === 0) {
      if (search.trim() && reservations.length > 0) {
        return (
          <EmptyState
            icon={EmptySearchIcon}
            title="Nenhum resultado para esta busca"
            description="A busca considera os registros desta página. Ajuste o termo ou limpe a busca."
            action={
              <Button size="small" variant="outlined" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            }
          />
        );
      }
      return (
        <EmptyState
          icon={<CalendarMonth />}
          title="Nenhuma reserva nesta categoria"
          description="Não há registros de reserva correspondentes a este filtro no momento."
        />
      );
    }

    return (
      <>
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
          <Table size="small" aria-label="Reservas do estabelecimento">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Solicitada em</TableCell>
                <TableCell>Hóspede</TableCell>
                <TableCell>Quarto</TableCell>
                <TableCell>Período</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pagamento</TableCell>
                <TableCell align="center" aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleReservations.map((reserva) => {
                const nights = nightsBetween(reserva.checkIn, reserva.checkOut);
                return (
                  <TableRow key={reserva.id} hover>
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip
                        label={reserva.codigoReserva}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, borderColor: 'divider' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(reserva.criadoEm)}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        {formatDate(reserva.criadoEm, { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {reserva.hospede?.nome || '—'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        noWrap
                        title={reserva.hospede?.email}
                        sx={{ display: 'block', maxWidth: 190 }}
                      >
                        {reserva.hospede?.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" color="textSecondary">
                        {reserva.quarto?.nome || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">
                        {formatDate(reserva.checkIn)} a {formatDate(reserva.checkOut)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {nights} {nights === 1 ? 'noite' : 'noites'} · {reserva.adultos}{' '}
                        {reserva.adultos === 1 ? 'adulto' : 'adultos'}
                        {reserva.criancas > 0
                          ? ` · ${reserva.criancas} ${reserva.criancas === 1 ? 'criança' : 'crianças'}`
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatCurrency(reserva.valorTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <StatusChip status={reserva.status} />
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      {reserva.modoPagamento ? (
                        <ModoPagamentoChip modo={reserva.modoPagamento} />
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                      {renderReservationActions(reserva)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Mobile: lista de cards */}
        <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' }, p: 2 }}>
          {visibleReservations.map((reserva) => {
            const nights = nightsBetween(reserva.checkIn, reserva.checkOut);
            return (
              <Box
                key={reserva.id}
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
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Chip
                    label={reserva.codigoReserva}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600, borderColor: 'divider' }}
                  />
                  <StatusChip status={reserva.status} />
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {reserva.hospede?.nome || '—'}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                  {reserva.quarto?.nome || 'Quarto a definir'} · {formatDate(reserva.checkIn)} a{' '}
                  {formatDate(reserva.checkOut)} · {nights} {nights === 1 ? 'noite' : 'noites'}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.25 }}>
                  Solicitada em {formatDate(reserva.criadoEm)} às{' '}
                  {formatDate(reserva.criadoEm, { hour: '2-digit', minute: '2-digit' })}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    mt: 1.5,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(reserva.valorTotal)}
                  </Typography>
                  {reserva.modoPagamento && <ModoPagamentoChip modo={reserva.modoPagamento} />}
                </Box>

                <Box sx={{ mt: 1 }}>{renderReservationActions(reserva)}</Box>
              </Box>
            );
          })}
        </Stack>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
            }
            sx={{
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: { xs: 'center', sm: 'flex-end' },
              },
            }}
          />
        </Box>
      </>
    );
  };

  const booting = loading;

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Gestão de reservas"
        title="Reservas"
        subtitle="Acompanhe solicitações, confirme reservas e aprove comprovantes de pagamento."
        icon={<Receipt />}
        actions={
          <>
            {establishments.length > 1 && (
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="est-select-label">Estabelecimento</InputLabel>
                <Select
                  labelId="est-select-label"
                  value={selectedEstablishment?.id || ''}
                  label="Estabelecimento"
                  onChange={(e) => handleEstablishmentChange(e.target.value)}
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
              startIcon={<Refresh />}
              onClick={fetchReservations}
              disabled={listLoading || !selectedEstablishment}
            >
              Atualizar
            </Button>
          </>
        }
      />

      {booting ? (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {[
              'Solicitações pendentes',
              'Aguardando pagamento',
              'Estadias concluídas',
              'Faturamento concluído',
            ].map((label) => (
              <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatCard
                  label={label}
                  value=""
                  loading
                  sx={{ borderRadius: `${radius.xl}px` }}
                />
              </Grid>
            ))}
          </Grid>
          <SectionCard noPadding>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <TableSkeleton rows={6} columns={6} />
            </Box>
          </SectionCard>
        </>
      ) : !selectedEstablishment ? (
        <SectionCard>
          <EmptyState
            icon={<Hotel />}
            title="Nenhum estabelecimento encontrado"
            description="Sua conta não está vinculada a um estabelecimento. Fale com o administrador da plataforma para regularizar o acesso."
          />
        </SectionCard>
      ) : (
        <Stack spacing={3}>
          {/* Indicadores */}
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Solicitações pendentes"
                value={pendingCount}
                icon={<Timer />}
                tone="warning"
                hint="Aguardando sua análise"
                loading={!statsLoaded}
                sx={{ borderRadius: `${radius.xl}px` }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Aguardando pagamento"
                value={awaitingPaymentCount}
                icon={<CalendarMonth />}
                tone="info"
                hint="Confirmadas sem pagamento aprovado"
                loading={!statsLoaded}
                sx={{ borderRadius: `${radius.xl}px` }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Estadias concluídas"
                value={finalizedCount}
                icon={<CheckCircleOutlined />}
                tone="success"
                hint="Reservas finalizadas"
                loading={!statsLoaded}
                sx={{ borderRadius: `${radius.xl}px` }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Faturamento concluído"
                value={formatCurrency(Number(totalRevenue))}
                icon={<AttachMoney />}
                tone="primary"
                hint="Soma das reservas finalizadas"
                loading={!statsLoaded}
                sx={{ borderRadius: `${radius.xl}px` }}
              />
            </Grid>
          </Grid>

          {/* Listagem */}
          <SectionCard
            title="Lista de reservas"
            subtitle={`${totalCount} ${totalCount === 1 ? 'reserva' : 'reservas'} no filtro atual`}
            noPadding
          >
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
              sx={{ px: { xs: 1, md: 2 } }}
              aria-label="Filtrar reservas por status"
            >
              <Tab label="Solicitações" />
              <Tab label="Aguardando pagamento" />
              <Tab label="Finalizadas" />
              <Tab label="Canceladas" />
              <Tab label="Todas" />
            </Tabs>

            <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5 }}>
              <DataToolbar sx={{ mb: 1.5 }}>
                <DataToolbarGroup>
                  <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar código, hóspede ou quarto"
                    width={360}
                  />
                </DataToolbarGroup>
                <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                  {search.trim()
                    ? `${visibleReservations.length} de ${reservations.length} nesta página`
                    : `${reservations.length} nesta página`}
                </Typography>
              </DataToolbar>

              {/* Filtro por período — vazio por padrão (lista todas as reservas) */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                  px: 1.5,
                  py: 1,
                  borderRadius: `${radius.lg}px`,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Tooltip
                  title={
                    campoData === 'estadia'
                      ? 'Mostra as reservas que se sobrepõem a este período (inclui quem já estava hospedado no início dele).'
                      : 'Mostra as reservas criadas (solicitadas) dentro deste período.'
                  }
                >
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, cursor: 'help' }}
                  >
                    <CalendarMonth fontSize="small" aria-hidden />
                    Filtrar por
                  </Typography>
                </Tooltip>
                <TextField
                  select
                  size="small"
                  label="Campo"
                  value={campoData}
                  onChange={(e) => {
                    setCampoData(e.target.value as 'estadia' | 'solicitacao');
                    setPage(0);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 190, flexShrink: 0 }}
                >
                  <MenuItem value="estadia">Período da estadia</MenuItem>
                  <MenuItem value="solicitacao">Data da solicitação</MenuItem>
                </TextField>
                <TextField
                  type="date"
                  size="small"
                  label={campoData === 'estadia' ? 'De' : 'Solicitada de'}
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPage(0);
                  }}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { 'aria-label': 'Data inicial do filtro' },
                  }}
                  sx={{ width: 176, flexShrink: 0 }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="Até"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPage(0);
                  }}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { 'aria-label': 'Data final do filtro' },
                  }}
                  sx={{ width: 158, flexShrink: 0 }}
                />
                {(dataInicio || dataFim) && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setDataInicio('');
                      setDataFim('');
                      setPage(0);
                    }}
                    startIcon={<Close fontSize="small" />}
                    sx={{ flexShrink: 0 }}
                  >
                    Limpar
                  </Button>
                )}
              </Box>
            </Box>

            {renderList()}
          </SectionCard>
        </Stack>
      )}

      {/* Detalhe da reserva */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="reserva-detalhe-titulo"
        sx={{ '& .MuiDialog-paper': { borderRadius: `${radius.xl}px` } }}
      >
        <DialogTitle
          id="reserva-detalhe-titulo"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            pr: 6,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span" sx={{ display: 'block' }}>
              Reserva {selectedReservation?.codigoReserva || ''}
            </Typography>
            {selectedReservation?.criadoEm && (
              <Typography variant="caption" color="textSecondary">
                Criada em {formatDate(selectedReservation.criadoEm)}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ ml: { sm: 'auto' }, flexWrap: 'wrap' }}>
            {selectedReservation && <StatusChip status={selectedReservation.status} />}
            {selectedReservation?.modoPagamento && (
              <ModoPagamentoChip modo={selectedReservation.modoPagamento} />
            )}
          </Stack>
          <IconButton
            aria-label="Fechar detalhes"
            onClick={() => setDetailsOpen(false)}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 3 }}>
          {selectedReservation && (
            <Stack spacing={3}>
              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  sx={{ display: 'block', mb: 1.5, fontWeight: 700 }}
                >
                  Estadia
                </Typography>
                <InfoGrid columns={2}>
                  <InfoItem label="Quarto" value={selectedReservation.quarto?.nome || '—'} />
                  <InfoItem
                    label="Hóspedes"
                    value={`${selectedReservation.adultos} ${
                      selectedReservation.adultos === 1 ? 'adulto' : 'adultos'
                    }${
                      selectedReservation.criancas > 0
                        ? ` e ${selectedReservation.criancas} ${
                            selectedReservation.criancas === 1 ? 'criança' : 'crianças'
                          }`
                        : ''
                    }`}
                  />
                  <InfoItem
                    label="Check-in"
                    value={formatDate(selectedReservation.checkIn)}
                    icon={<CalendarMonth sx={{ fontSize: 16 }} />}
                  />
                  <InfoItem
                    label="Check-out"
                    value={formatDate(selectedReservation.checkOut)}
                    icon={<CalendarMonth sx={{ fontSize: 16 }} />}
                  />
                  <InfoItem
                    label="Duração"
                    value={`${detailsNights} ${detailsNights === 1 ? 'noite' : 'noites'}`}
                  />
                  <InfoItem
                    label="Valor total"
                    value={formatCurrency(selectedReservation.valorTotal)}
                    emphasis
                  />
                </InfoGrid>
              </Box>

              {selectedReservation.observacoes && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: `${radius.lg}px`,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}
                  >
                    Observações do hóspede
                  </Typography>
                  <Typography variant="body2">{selectedReservation.observacoes}</Typography>
                </Box>
              )}

              {selectedReservation.cancelamentoMotivo && (
                <Alert severity="error">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Motivo do cancelamento
                  </Typography>
                  <Typography variant="body2">{selectedReservation.cancelamentoMotivo}</Typography>
                </Alert>
              )}

              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  sx={{ display: 'block', mb: 1.5, fontWeight: 700 }}
                >
                  Hóspede
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderRadius: `${radius.lg}px`,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Avatar sx={{ bgcolor: 'action.selected', color: 'primary.main', fontWeight: 700 }}>
                    {selectedReservation.hospede?.nome?.charAt(0)?.toUpperCase() || '?'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {selectedReservation.hospede?.nome || '—'}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      <Typography
                        variant="caption"
                        component="a"
                        href={`mailto:${selectedReservation.hospede?.email}`}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        <Email sx={{ fontSize: 16 }} aria-hidden />
                        {selectedReservation.hospede?.email}
                      </Typography>
                      {selectedReservation.hospede?.telefone && (
                        <Typography
                          variant="caption"
                          component="a"
                          href={`tel:${selectedReservation.hospede?.telefone}`}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            color: 'text.secondary',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          <Phone sx={{ fontSize: 16 }} aria-hidden />
                          {selectedReservation.hospede?.telefone}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="overline"
                  color="primary"
                  sx={{ display: 'block', mb: 1.5, fontWeight: 700 }}
                >
                  Pagamento
                </Typography>

                {paymentLoading ? (
                  <InlineLoading label="Carregando dados do pagamento⬦" />
                ) : !detailedPayment ? (
                  <EmptyState
                    compact
                    icon={<AttachMoney />}
                    title="Nenhuma cobrança gerada ainda"
                    description={
                      isMpEstabelecimento
                        ? 'O hóspede ainda não iniciou o checkout no Mercado Pago. Assim que pagar, a confirmação chega automaticamente.'
                        : 'O hóspede ainda não escolheu a forma de pagamento. No modo Pagamento direto ele precisa enviar o comprovante por Pix, boleto ou cartão.'
                    }
                  />
                ) : (
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: `${radius.lg}px`,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {/* Forma escolhida em destaque — é a informação que o gestor
                        precisa para conferir o comprovante. */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.75,
                        mb: 2,
                        borderRadius: `${radius.md}px`,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Box sx={{ color: 'primary.main', display: 'flex' }}>
                        <AttachMoney aria-hidden />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                          Forma de pagamento escolhida
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                          {paymentMethodLabel(detailedPayment.metodo)}
                        </Typography>
                      </Box>
                      <Box sx={{ ml: 'auto', flexShrink: 0 }}>
                        <StatusChip
                          status={paymentChipStatus(detailedPayment.status)}
                          label={
                            PAYMENT_STATUS_LABEL[detailedPayment.status] || detailedPayment.status
                          }
                        />
                      </Box>
                    </Box>

                    <InfoGrid columns={2}>
                      <InfoItem
                        label="Valor do pagamento"
                        value={formatCurrency(detailedPayment.valor)}
                        emphasis
                      />
                      <InfoItem
                        label="Modo do estabelecimento"
                        value={<ModoPagamentoChip modo={selectedReservation?.modoPagamento} />}
                      />
                      {detailedPayment.codigoTransacao && (
                        <InfoItem
                          label="Código da transação"
                          value={
                            <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                              {detailedPayment.codigoTransacao}
                            </Typography>
                          }
                        />
                      )}
                    </InfoGrid>

                    {isMpEstabelecimento && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Confirmação automática via Mercado Pago — não é necessário anexar comprovante.
                      </Alert>
                    )}

                    {!isMpEstabelecimento && detailedPayment.comprovanteUrl && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PictureAsPdf />}
                          endIcon={<OpenInNew />}
                          component="a"
                          href={detailedPayment.comprovanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          fullWidth
                          sx={{ justifyContent: 'space-between' }}
                        >
                          Visualizar comprovante
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 2.5,
            gap: 1,
            flexWrap: 'wrap',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button onClick={() => setDetailsOpen(false)} color="inherit">
            Fechar
          </Button>
          <Box sx={{ flex: 1 }} />

          {selectedReservation && selectedReservation.status === 'SOLICITADA' && (
            <>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  setDetailsOpen(false);
                  handleOpenCancel(selectedReservation);
                }}
                disabled={actionLoading}
              >
                Recusar reserva
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setDetailsOpen(false);
                  handleRequestConfirm(selectedReservation);
                }}
                disabled={actionLoading}
              >
                Confirmar reserva
              </Button>
            </>
          )}

          {selectedReservation &&
            (selectedReservation.status === 'CONFIRMADA' ||
              selectedReservation.status === 'AGUARDANDO_PAGAMENTO') &&
            !isMpEstabelecimento &&
            detailedPayment?.comprovanteUrl && (
              <Button
                variant="contained"
                color="success"
                onClick={handleRequestFinalize}
                disabled={actionLoading}
              >
                Aprovar pagamento e finalizar
              </Button>
            )}
        </DialogActions>
      </Dialog>

      {/* Confirmação de reserva */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar reserva"
        description={
          <>
            A reserva <strong>{reservationToConfirm?.codigoReserva}</strong> de{' '}
            <strong>{reservationToConfirm?.hospede?.nome}</strong> será confirmada e o hóspede
            notificado para realizar o pagamento.
          </>
        }
        confirmLabel="Confirmar reserva"
        cancelLabel="Voltar"
        loading={actionLoading}
        onConfirm={handleSubmitConfirm}
        onClose={() => setConfirmOpen(false)}
      >
        {reservationToConfirm && (
          <Box sx={{ mt: 2 }}>
            <InfoGrid columns={2}>
              <InfoItem
                label="Período"
                value={`${formatDate(reservationToConfirm.checkIn)} a ${formatDate(
                  reservationToConfirm.checkOut,
                )}`}
              />
              <InfoItem label="Valor total" value={formatCurrency(reservationToConfirm.valorTotal)} />
            </InfoGrid>
          </Box>
        )}
      </ConfirmDialog>

      {/* Aprovar pagamento e finalizar */}
      <ConfirmDialog
        open={finalizeOpen}
        title="Aprovar pagamento e finalizar"
        description={
          <>
            O pagamento da reserva <strong>{reservationToFinalize?.codigoReserva}</strong> será
            aprovado e a reserva finalizada. Confirme que o comprovante foi conferido.
          </>
        }
        confirmLabel="Aprovar e finalizar"
        cancelLabel="Voltar"
        loading={actionLoading}
        onConfirm={handleSubmitFinalize}
        onClose={() => setFinalizeOpen(false)}
      >
        {reservationToFinalize && detailedPayment && (
          <Box sx={{ mt: 2 }}>
            <InfoGrid columns={2}>
              <InfoItem label="Forma de pagamento" value={paymentMethodLabel(detailedPayment.metodo)} />
              <InfoItem label="Valor" value={formatCurrency(detailedPayment.valor)} emphasis />
            </InfoGrid>
          </Box>
        )}
      </ConfirmDialog>

      {/* Cancelamento com justificativa obrigatória */}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar reserva"
        tone="error"
        confirmLabel="Cancelar reserva"
        cancelLabel="Voltar"
        loading={actionLoading}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelOpen(false)}
        description={
          <>
            Informe o motivo do cancelamento da reserva{' '}
            <strong>{reservationToCancel?.codigoReserva}</strong>. O hóspede será notificado por
            e-mail.
          </>
        }
      >
        <Box sx={{ mt: 2 }}>
          <FormError message={cancelError ? 'O motivo do cancelamento é obrigatório.' : undefined} />
          <TextField
            label="Motivo do cancelamento"
            fullWidth
            required
            multiline
            minRows={3}
            disabled={actionLoading}
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError(false);
            }}
            placeholder="Ex: não identificamos o pagamento no prazo estabelecido."
            error={cancelError}
          />
        </Box>
      </ConfirmDialog>
    </PageContainer>
  );
}
