import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
  Alert,
  IconButton,
  TablePagination,
  alpha,
  useTheme,
  useMediaQuery,
  LinearProgress,
  ImageList,
  ImageListItem,
} from '@mui/material';
import {
  CalendarMonth,
  People,
  AttachMoney,
  Info,
  Phone,
  Email,
  LocationOn,
  OpenInNew,
  CloudUpload,
  ContentCopy,
  CheckCircleOutlined,
  CancelOutlined,
  Close,
  WarningAmber,
  Payment,
  ReceiptLong,
  Image,
} from '@mui/icons-material';
import { reservationsApi, paymentsApi } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

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
  fotos?: Foto[];
}

interface Cidade {
  id: string;
  nome: string;
  estado: string;
}

interface Foto {
  id: string;
  url: string;
  isCapa: boolean;
}

interface Establishment {
  id: string;
  nome: string;
  contato?: string;
  emailContato?: string;
  website?: string;
  endereco?: string;
  cidade: Cidade;
  fotos: Foto[];
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
  estabelecimento: Establishment;
  quarto: Quarto;
  pagamento?: Payment | null;
}

interface PixData {
  pixKey: string;
  pixType: string;
  valor: string | number;
  codigoReserva: string;
  qrCode: string;
  pixCopyPaste: string;
}

const statusMap = {
  SOLICITADA: { label: 'Solicitada', color: 'info' as const, bg: 'rgba(2, 136, 209, 0.08)', text: '#0288d1' },
  CONFIRMADA: { label: 'Confirmada / Pagar', color: 'warning' as const, bg: 'rgba(245, 158, 11, 0.08)', text: '#d97706' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando Validação', color: 'warning' as const, bg: 'rgba(245, 158, 11, 0.08)', text: '#d97706' },
  FINALIZADA: { label: 'Finalizada', color: 'success' as const, bg: 'rgba(16, 185, 129, 0.08)', text: '#059669' },
  CANCELADA: { label: 'Cancelada', color: 'error' as const, bg: 'rgba(239, 68, 68, 0.08)', text: '#dc2626' },
};

const formatCurrency = (val: string | number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
};

export default function GuestReservations() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();

  // Selected states
  const [activeTab, setActiveTab] = useState(0); // 0: Todas, 1: Solicitadas, 2: A pagar (CONFIRMADA/AGUARDANDO_PAGAMENTO), 3: Concluídas, 4: Canceladas
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(6);

  // Dialog & modal states
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Payment states inside details modal
  const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'PIX' | 'CARTAO' | 'BOLETO'>('PIX');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);

  // Credit card form mock states
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardSubmitting, setCardSubmitting] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  // Cancel reservation states
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Fetch all guest reservations
  const { data: allReservations = [], isLoading, refetch } = useQuery<Reservation[]>({
    queryKey: ['guest-reservations-all'],
    queryFn: async () => {
      const res = await reservationsApi.getAll({ limit: 1000 });
      return res.data?.data?.data || res.data?.data || res.data || [];
    },
    refetchInterval: 15_000,
  });

  // Calculate dynamic stats
  const totalCount = allReservations.length;
  const pendingCount = allReservations.filter((r) => r.status === 'SOLICITADA').length;
  const awaitingPaymentCount = allReservations.filter(
    (r) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO'
  ).length;
  const finalizedCount = allReservations.filter((r) => r.status === 'FINALIZADA').length;
  const canceledCount = allReservations.filter((r) => r.status === 'CANCELADA').length;

  // Filter reservations based on active tab
  const getFilteredReservations = () => {
    switch (activeTab) {
      case 1:
        return allReservations.filter((r) => r.status === 'SOLICITADA');
      case 2:
        return allReservations.filter(
          (r) => r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO'
        );
      case 3:
        return allReservations.filter((r) => r.status === 'FINALIZADA');
      case 4:
        return allReservations.filter((r) => r.status === 'CANCELADA');
      case 0:
      default:
        return allReservations;
    }
  };

  const filteredReservations = getFilteredReservations();
  const paginatedReservations = filteredReservations.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );

  const handleTabChange = (_: any, newValue: number) => {
    setActiveTab(newValue);
    setPage(0);
  };

  const handleChangePage = (_: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Open Details Modal and load up-to-date payment status
  const handleOpenDetails = async (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailedPayment(reservation.pagamento || null);
    setSelectedFile(null);
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setDetailsOpen(true);
    setPixData(null);
    setSelectedPaymentMethod(reservation.pagamento?.metodo || 'PIX');

    // Fetch refreshed payment details
    try {
      setPaymentLoading(true);
      const res = await paymentsApi.getByReservation(reservation.id);
      const pData = res.data?.data || res.data;
      if (pData) {
        setDetailedPayment(pData);
        setSelectedPaymentMethod(pData.metodo);
        if (pData.metodo === 'PIX') {
          loadPixDetails(reservation.id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar pagamento da reserva:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Load PIX credentials from backend
  const loadPixDetails = async (reservationId: string) => {
    try {
      setLoadingPix(true);
      const res = await paymentsApi.generatePix(reservationId);
      const data = res.data?.data || res.data;
      if (data) {
        setPixData(data);
      }
    } catch (err) {
      console.error('Erro ao gerar PIX:', err);
    } finally {
      setLoadingPix(false);
    }
  };

  const handlePaymentMethodChange = (method: 'PIX' | 'CARTAO' | 'BOLETO') => {
    setSelectedPaymentMethod(method);
    if (method === 'PIX' && !pixData && selectedReservation) {
      loadPixDetails(selectedReservation.id);
    }
  };

  // Get or create payment helper
  const getOrCreatePaymentObject = async (reservation: Reservation, method: 'PIX' | 'CARTAO' | 'BOLETO') => {
    if (detailedPayment?.id) {
      return detailedPayment;
    }
    // Create new payment
    const resCreate = await paymentsApi.create({
      reservaId: reservation.id,
      metodo: method,
    });
    const newPayment = resCreate.data?.data || resCreate.data;
    if (!newPayment?.id) {
      throw new Error('Pagamento criado sem ID');
    }
    setDetailedPayment(newPayment);
    return newPayment;
  };

  // Copy Pix copy-paste key
  const handleCopyPix = () => {
    if (pixData?.pixCopyPaste) {
      navigator.clipboard.writeText(pixData.pixCopyPaste);
      toast.success('Código PIX Copia e Cola copiado para a área de transferência!');
    }
  };

  // Copy Boleto barcode
  const handleCopyBoleto = () => {
    const code = '34191.79001 01043.513184 91020.150008 7 98760000015000';
    navigator.clipboard.writeText(code);
    toast.success('Código de barras do boleto copiado!');
  };

  // Simulated Credit Card Payment Action
  const handleCreditCardPay = async () => {
    if (!selectedReservation) return;
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os campos do cartão de crédito.');
      return;
    }

    try {
      setCardSubmitting(true);
      // 1. Ensure payment object exists
      const paymentObj = await getOrCreatePaymentObject(selectedReservation, 'CARTAO');

      if (!paymentObj?.id) {
        toast.error('Erro ao obter pagamento. Tente novamente.');
        setCardSubmitting(false);
        return;
      }

      // Simulate authorization delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Confirm payment on backend
      await paymentsApi.confirm(paymentObj.id);

      toast.success('Pagamento com cartão simulado e aprovado com sucesso! 🎉');
      
      // Refresh queries
      refetch();
      
      // Close modal
      setDetailsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Erro ao processar pagamento com cartão.');
    } finally {
      setCardSubmitting(false);
    }
  };

  // File receipt upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('O arquivo deve ser menor que 5MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadComprovante = async () => {
    if (!selectedReservation || !selectedFile) {
      toast.error('Por favor, selecione um arquivo.');
      return;
    }

    try {
      setUploadingComprovante(true);
      
      // 1. Ensure payment object exists
      const paymentObj = await getOrCreatePaymentObject(selectedReservation, selectedPaymentMethod);

      if (!paymentObj?.id) {
        toast.error('Erro ao obter pagamento. Tente novamente.');
        setUploadingComprovante(false);
        return;
      }

      // 2. Upload receipt
      const res = await paymentsApi.uploadComprovante(paymentObj.id, selectedFile);
      const updatedPayment = res.data?.data || res.data;
      
      setDetailedPayment(updatedPayment);
      setSelectedFile(null);
      toast.success('Comprovante de pagamento enviado com sucesso! Aguarde a validação.');
      
      // Refresh list
      refetch();
      
      // Close details modal
      setDetailsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Erro ao enviar comprovante de pagamento.');
    } finally {
      setUploadingComprovante(false);
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
      setCancelling(true);
      await reservationsApi.cancel(reservationToCancel.id, { motivo: cancelReason });
      toast.success('Reserva cancelada com sucesso.');
      setCancelOpen(false);
      setReservationToCancel(null);
      refetch();
      if (detailsOpen) {
        setDetailsOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao cancelar reserva');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 1 }}>
          Minhas Reservas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Acompanhe suas solicitações de hospedagem, realize pagamentos e gerencie comprovantes de check-in.
        </Typography>
      </Box>

      {/* Stats Dashboard */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 100, justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Todas</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>{totalCount}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 100, justifyContent: 'center', borderLeft: `4px solid ${theme.palette.info.main}` }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Solicitadas</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.info.main }}>{pendingCount}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 100, justifyContent: 'center', borderLeft: `4px solid ${theme.palette.warning.main}` }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>A Pagar</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.warning.main }}>{awaitingPaymentCount}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 100, justifyContent: 'center', borderLeft: `4px solid ${theme.palette.success.main}` }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Finalizadas</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.success.main }}>{finalizedCount}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 100, justifyContent: 'center', borderLeft: `4px solid ${theme.palette.error.main}` }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Canceladas</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theme.palette.error.main }}>{canceledCount}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs Filter */}
      <Paper sx={{ mb: 3, borderRadius: '12px', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Todas" sx={{ py: 2, px: 3, fontWeight: 600 }} />
          <Tab label={`Solicitadas (${pendingCount})`} sx={{ py: 2, px: 3, fontWeight: 600 }} />
          <Tab label={`A Pagar (${awaitingPaymentCount})`} sx={{ py: 2, px: 3, fontWeight: 600 }} />
          <Tab label={`Concluídas (${finalizedCount})`} sx={{ py: 2, px: 3, fontWeight: 600 }} />
          <Tab label={`Canceladas (${canceledCount})`} sx={{ py: 2, px: 3, fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && filteredReservations.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px dashed rgba(0,0,0,0.1)' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            Nenhuma reserva encontrada
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Você não possui reservas nesta categoria no momento.
          </Typography>
          <Button variant="contained" color="primary" href="/busca" size="medium">
            Buscar Hospedagens
          </Button>
        </Paper>
      )}

      {/* Reservations Card Grid */}
      {!isLoading && filteredReservations.length > 0 && (
        <Grid container spacing={3}>
          {paginatedReservations.map((reservation) => {
            const statusConfig = statusMap[reservation.status] || {
              label: reservation.status,
              color: 'default' as const,
              bg: '#f1f5f9',
              text: '#475569',
            };

            const coverPhoto =
              reservation.estabelecimento?.fotos?.find((f) => f.isCapa)?.url ||
              reservation.estabelecimento?.fotos?.[0]?.url ||
              '';

            const checkInFormatted = dayjs(reservation.checkIn).format('DD/MM/YYYY');
            const checkOutFormatted = dayjs(reservation.checkOut).format('DD/MM/YYYY');
            const nights = dayjs(reservation.checkOut).diff(dayjs(reservation.checkIn), 'day');

            return (
              <Grid key={reservation.id} size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Image Section */}
                  <Box sx={{ width: { xs: '100%', sm: 180 }, minWidth: { xs: '100%', sm: 180 }, position: 'relative' }}>
                    {coverPhoto ? (
                      <CardMedia
                        component="img"
                        image={coverPhoto}
                        alt={reservation.estabelecimento.nome}
                        sx={{ height: { xs: 160, sm: '100%' }, objectFit: 'cover' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: { xs: 160, sm: '100%' },
                          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.7)} 0%, ${alpha(
                            theme.palette.secondary.main,
                            0.7
                          )} 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {reservation.estabelecimento.nome.charAt(0)}
                        </Typography>
                      </Box>
                    )}
                    <Chip
                      label={statusConfig.label}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        backgroundColor: statusConfig.bg,
                        color: statusConfig.text,
                        borderColor: statusConfig.text,
                        border: '1px solid',
                        fontWeight: 600,
                      }}
                    />
                  </Box>

                  {/* Content Section */}
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Cód: {reservation.codigoReserva}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(reservation.criadoEm).format('DD MMM YYYY, HH:mm')}
                      </Typography>
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.2 }}>
                      {reservation.estabelecimento.nome}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                      <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {reservation.estabelecimento.cidade.nome} - {reservation.estabelecimento.cidade.estado}
                      </Typography>
                    </Box>

                    <Divider sx={{ mb: 1.5 }} />

                    {/* Room & Dates Info */}
                    <Box sx={{ mb: 2, flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        Quarto: {reservation.quarto.nome}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarMonth sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                          <Typography variant="body2" color="text.secondary">
                            {checkInFormatted} a {checkOutFormatted} ({nights} {nights === 1 ? 'noite' : 'noites'})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <People sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                          <Typography variant="body2" color="text.secondary">
                            {reservation.adultos} A, {reservation.criancas} C
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Actions and Price Footer */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 'auto',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary">Valor Total</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>
                          {formatCurrency(reservation.valorTotal)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {(reservation.status === 'SOLICITADA' ||
                          reservation.status === 'CONFIRMADA' ||
                          reservation.status === 'AGUARDANDO_PAGAMENTO') && (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleOpenCancel(reservation)}
                          >
                            Cancelar
                          </Button>
                        )}
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleOpenDetails(reservation)}
                        >
                          {reservation.status === 'CONFIRMADA' || reservation.status === 'AGUARDANDO_PAGAMENTO' ? 'Pagar / Detalhes' : 'Ver Detalhes'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Pagination component */}
      {!isLoading && filteredReservations.length > 0 && (
        <TablePagination
          component="div"
          count={filteredReservations.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[6, 12, 24]}
          labelRowsPerPage="Itens por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          sx={{ mt: 4 }}
        />
      )}

      {/* Cancel Reservation Confirmation Dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theme.palette.error.main }}>
          <WarningAmber /> Cancelar Reserva
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Você tem certeza que deseja cancelar sua reserva <strong>{reservationToCancel?.codigoReserva}</strong> no{' '}
            <strong>{reservationToCancel?.estabelecimento?.nome}</strong>? Esta ação é irreversível.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Motivo do Cancelamento (opcional)"
            fullWidth
            variant="outlined"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            slotProps={{
              input: {
                sx: { borderRadius: '10px' },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCancelOpen(false)} disabled={cancelling}>
            Voltar
          </Button>
          <Button onClick={handleConfirmCancel} color="error" variant="contained" disabled={cancelling}>
            {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detailed View & Payment Modal */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: { borderRadius: '16px' },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
              Detalhes da Reserva
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Código Único: {selectedReservation?.codigoReserva}
            </Typography>
          </Box>
          <IconButton onClick={() => setDetailsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {selectedReservation && (
            <Grid container spacing={3}>
              {/* Left Column: Reservation Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info color="primary" /> Informações Gerais
                </Typography>

                <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#F8FAFC', borderRadius: '12px' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Hospedagem</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {selectedReservation.estabelecimento.nome}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedReservation.estabelecimento.endereco} - {selectedReservation.estabelecimento.cidade.nome},{' '}
                      {selectedReservation.estabelecimento.cidade.estado}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Acomodação</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedReservation.quarto.nome}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Capacidade Máxima: {selectedReservation.quarto.capacidade} pessoas
                    </Typography>
                    {selectedReservation.quarto.fotos && selectedReservation.quarto.fotos.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        <ImageList cols={3} gap={4} sx={{ m: 0 }}>
                          {selectedReservation.quarto.fotos.map((foto) => (
                            <ImageListItem key={foto.id}>
                              <img
                                src={foto.url}
                                alt={selectedReservation.quarto.nome}
                                style={{ height: 72, width: '100%', objectFit: 'cover', borderRadius: 6 }}
                              />
                            </ImageListItem>
                          ))}
                        </ImageList>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Check-in</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {dayjs(selectedReservation.checkIn).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Check-out</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {dayjs(selectedReservation.checkOut).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Noites</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {dayjs(selectedReservation.checkOut).diff(dayjs(selectedReservation.checkIn), 'day')}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Hóspedes</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedReservation.adultos} Adulto(s) {selectedReservation.criancas > 0 && `e ${selectedReservation.criancas} Criança(s)`}
                    </Typography>
                  </Box>

                  {selectedReservation.observacoes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Observações</Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        "{selectedReservation.observacoes}"
                      </Typography>
                    </Box>
                  )}
                </Paper>

                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Phone color="primary" /> Contato do Estabelecimento
                </Typography>

                <Paper sx={{ p: 2.5, bgcolor: '#F8FAFC', borderRadius: '12px' }}>
                  {selectedReservation.estabelecimento.contato && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Phone sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">{selectedReservation.estabelecimento.contato}</Typography>
                    </Box>
                  )}
                  {selectedReservation.estabelecimento.emailContato && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Email sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">{selectedReservation.estabelecimento.emailContato}</Typography>
                    </Box>
                  )}
                  {selectedReservation.estabelecimento.website && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <OpenInNew sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography
                        variant="body2"
                        component="a"
                        href={
                          selectedReservation.estabelecimento.website.startsWith('http')
                            ? selectedReservation.estabelecimento.website
                            : `https://${selectedReservation.estabelecimento.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: theme.palette.primary.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        Visitar Website
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Right Column: Payment Widget / Status Actions */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Payment color="primary" /> Financeiro e Pagamento
                </Typography>

                <Paper sx={{ p: 2.5, borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  {/* Total amount header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>Valor Cobrado</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>
                      {formatCurrency(selectedReservation.valorTotal)}
                    </Typography>
                  </Box>

                  {/* Flow 1: Reservation Solicited (Waiting approval) */}
                  {selectedReservation.status === 'SOLICITADA' && (
                    <Alert severity="info" icon={<WarningAmber />} sx={{ borderRadius: '8px' }}>
                      Esta reserva foi solicitada e está aguardando a análise do estabelecimento. Assim que for pré-aprovada, as informações de pagamento serão liberadas.
                    </Alert>
                  )}

                  {/* Flow 2: Canceled Reservation */}
                  {selectedReservation.status === 'CANCELADA' && (
                    <Box>
                      <Alert severity="error" icon={<CancelOutlined />} sx={{ borderRadius: '8px', mb: 2 }}>
                        Reserva cancelada.
                      </Alert>
                      {selectedReservation.cancelamentoMotivo && (
                        <Paper sx={{ p: 2, bgcolor: '#FFF5F5', color: '#C53030', borderRadius: '8px' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                            Motivo do Cancelamento:
                          </Typography>
                          <Typography variant="body2">{selectedReservation.cancelamentoMotivo}</Typography>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {/* Flow 3: Finalized Reservation */}
                  {selectedReservation.status === 'FINALIZADA' && (
                    <Box>
                      <Alert severity="success" icon={<CheckCircleOutlined />} sx={{ borderRadius: '8px', mb: 2 }}>
                        Pagamento recebido e reserva confirmada! 🎉
                      </Alert>
                      {detailedPayment && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Detalhes do Pagamento
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Método: {detailedPayment.metodo}
                          </Typography>
                          {detailedPayment.codigoTransacao && (
                            <Typography variant="body2" color="text.secondary">
                              Transação: {detailedPayment.codigoTransacao}
                            </Typography>
                          )}
                          {detailedPayment.comprovanteUrl && (
                            <Button
                              variant="outlined"
                              color="success"
                              size="small"
                              startIcon={<ReceiptLong />}
                              href={detailedPayment.comprovanteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ mt: 2, borderRadius: '8px' }}
                            >
                              Ver Comprovante
                            </Button>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Flow 4: CONFIRMADA or AGUARDANDO_PAGAMENTO */}
                  {(selectedReservation.status === 'CONFIRMADA' ||
                    selectedReservation.status === 'AGUARDANDO_PAGAMENTO') && (
                    <Box>
                      {/* Check if payment is already confirmed or comprovante is sent */}
                      {detailedPayment?.status === 'CONFIRMADO' || detailedPayment?.comprovanteUrl ? (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <CheckCircleOutlined color="success" sx={{ fontSize: 48, mb: 1 }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                            Comprovante Enviado!
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            O estabelecimento está analisando o recibo do seu pagamento. Você será notificado assim que for compensado.
                          </Typography>
                          {detailedPayment?.comprovanteUrl && (
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<ReceiptLong />}
                              href={detailedPayment.comprovanteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ borderRadius: '8px' }}
                            >
                              Visualizar Comprovante
                            </Button>
                          )}
                        </Box>
                      ) : (
                        // Render payment simulator options
                        <Box>
                          <Alert severity="warning" icon={<WarningAmber />} sx={{ borderRadius: '8px', mb: 3 }}>
                            Aguardando seu pagamento para consolidar a hospedagem. Escolha a forma de pagamento abaixo.
                          </Alert>

                          {/* Payment tabs */}
                          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                            {(['PIX', 'BOLETO', 'CARTAO'] as const).map((method) => (
                              <Button
                                key={method}
                                variant={selectedPaymentMethod === method ? 'contained' : 'outlined'}
                                color={selectedPaymentMethod === method ? 'primary' : 'primary'}
                                onClick={() => handlePaymentMethodChange(method)}
                                sx={{
                                  flexGrow: 1,
                                  borderRadius: '8px',
                                  py: 1,
                                  px: 0.5,
                                  fontSize: '0.8rem',
                                  boxShadow: 'none',
                                }}
                              >
                                {method === 'PIX' ? 'PIX' : method === 'BOLETO' ? 'Boleto' : 'Cartão'}
                              </Button>
                            ))}
                          </Box>

                          {paymentLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                              <CircularProgress size={24} />
                            </Box>
                          )}

                          {/* PIX Method */}
                          {!paymentLoading && selectedPaymentMethod === 'PIX' && (
                            <Box>
                              {loadingPix ? (
                                <Box sx={{ py: 3 }}>
                                  <LinearProgress />
                                </Box>
                              ) : (
                                pixData && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                                    <Box
                                      component="img"
                                      src={pixData.qrCode}
                                      alt="QR Code Pix"
                                      sx={{
                                        width: 160,
                                        height: 160,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: '12px',
                                        p: 1,
                                        mb: 2,
                                      }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                                      Escaneie o código com o app do seu banco ou use a chave abaixo.
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<ContentCopy />}
                                      onClick={handleCopyPix}
                                      fullWidth
                                      sx={{ borderRadius: '8px' }}
                                    >
                                      Copiar Código Pix Copia e Cola
                                    </Button>
                                  </Box>
                                )
                              )}
                            </Box>
                          )}

                          {/* BOLETO Method */}
                          {!paymentLoading && selectedPaymentMethod === 'BOLETO' && (
                            <Box sx={{ mb: 3 }}>
                              <Paper sx={{ p: 2.5, bgcolor: '#F8FAFC', border: '1px dashed rgba(0,0,0,0.1)', borderRadius: '8px', mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  Linha Digitável do Boleto
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    my: 1.5,
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  34191.79001 01043.513184 91020.150008 7 98760000015000
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Vencimento: em até 3 dias úteis.
                                </Typography>
                              </Paper>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ContentCopy />}
                                onClick={handleCopyBoleto}
                                fullWidth
                                sx={{ borderRadius: '8px' }}
                              >
                                Copiar Linha Digitável
                              </Button>
                            </Box>
                          )}

                          {/* CREDIT CARD Method */}
                          {!paymentLoading && selectedPaymentMethod === 'CARTAO' && (
                            <Box sx={{ mb: 3 }}>
                              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                                <Grid size={{ xs: 12 }}>
                                  <TextField
                                    label="Nome do Titular"
                                    size="small"
                                    fullWidth
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value)}
                                    slotProps={{ input: { sx: { borderRadius: '8px' } } }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                  <TextField
                                    label="Número do Cartão"
                                    size="small"
                                    fullWidth
                                    placeholder="4000 1234 5678 9010"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(e.target.value)}
                                    slotProps={{ input: { sx: { borderRadius: '8px' } } }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <TextField
                                    label="Validade"
                                    size="small"
                                    fullWidth
                                    placeholder="MM/AA"
                                    value={cardExpiry}
                                    onChange={(e) => setCardExpiry(e.target.value)}
                                    slotProps={{ input: { sx: { borderRadius: '8px' } } }}
                                  />
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <TextField
                                    label="CVV"
                                    size="small"
                                    fullWidth
                                    placeholder="123"
                                    value={cardCvv}
                                    onChange={(e) => setCardCvv(e.target.value)}
                                    slotProps={{ input: { sx: { borderRadius: '8px' } } }}
                                  />
                                </Grid>
                              </Grid>
                              <Button
                                variant="contained"
                                color="secondary"
                                fullWidth
                                disabled={cardSubmitting}
                                onClick={handleCreditCardPay}
                                sx={{ borderRadius: '8px', py: 1 }}
                              >
                                {cardSubmitting ? (
                                  <CircularProgress size={20} color="inherit" />
                                ) : (
                                  'Simular Pagamento com Cartão'
                                )}
                              </Button>
                            </Box>
                          )}

                          <Divider sx={{ my: 3 }} />

                          {/* File upload section */}
                          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
                            Enviar Comprovante (Obrigatório para PIX/Boleto)
                          </Typography>
                          
                          <Box
                            sx={{
                              border: '2px dashed rgba(0,0,0,0.12)',
                              borderRadius: '12px',
                              p: 2.5,
                              textAlign: 'center',
                              bgcolor: '#F8FAFC',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.02),
                              },
                              position: 'relative',
                            }}
                            component="label"
                          >
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              hidden
                              onChange={handleFileChange}
                            />
                            <CloudUpload color="primary" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {selectedFile ? selectedFile.name : 'Clique para selecionar o arquivo'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Suporta imagens (PNG, JPG) ou PDFs de até 5MB.
                            </Typography>
                          </Box>

                          {selectedFile && (
                            <Button
                              variant="contained"
                              color="primary"
                              fullWidth
                              sx={{ mt: 2, borderRadius: '8px' }}
                              onClick={handleUploadComprovante}
                              disabled={uploadingComprovante}
                            >
                              {uploadingComprovante ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                'Enviar Comprovante de Pagamento'
                              )}
                            </Button>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {selectedReservation &&
            (selectedReservation.status === 'SOLICITADA' ||
              selectedReservation.status === 'CONFIRMADA' ||
              selectedReservation.status === 'AGUARDANDO_PAGAMENTO') && (
              <Button
                color="error"
                variant="outlined"
                onClick={() => handleOpenCancel(selectedReservation)}
              >
                Cancelar Reserva
              </Button>
            )}
          <Button onClick={() => setDetailsOpen(false)} variant="contained" color="primary">
            Fechar Detalhes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
