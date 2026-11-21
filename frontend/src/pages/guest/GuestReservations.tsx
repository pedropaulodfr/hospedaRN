import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Tab,
  TablePagination,
  Tabs,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  CalendarMonth,
  CancelOutlined,
  CheckCircleOutlined,
  Close,
  CloudUpload,
  ContentCopy,
  Email,
  Hotel,
  LocationOn,
  OpenInNew,
  Payment,
  People,
  Phone,
  ReceiptLong,
  Refresh,
  Search,
  WarningAmber,
} from '@mui/icons-material';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InfoGrid,
  InfoItem,
  InfoRow,
  ModoPagamentoChip,
  PageContainer,
  PageHeader,
  PageLoading,
  SectionCard,
  StatCard,
  StatusChip,
} from '../../components/common';
import { formatCurrency, formatDate } from '../../theme/tokens';
import { reservationsApi, paymentsApi } from '../../services/api';
import { GUEST_RESERVATIONS_KEY, invalidateGuestReservations } from '../../services/queryKeys';
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
  modoPagamento?: 'PADRAO' | 'MERCADO_PAGO';
}

interface MpCheckoutData {
  qrCodeBase64?: string;
  pixCopyPaste?: string;
  boletoBarcode?: string;
  boletoUrl?: string;
  initPoint?: string;
}

interface MercadoPagoCheckout {
  paymentId?: string;
  metodo?: 'PIX' | 'BOLETO' | 'CARTAO';
  checkout?: MpCheckoutData;
}

interface Payment {
  id: string;
  reservaId: string;
  codigoTransacao?: string;
  metodo: 'PIX' | 'CARTAO' | 'BOLETO';
  comprovanteUrl?: string;
  valor: number | string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'ESTORNADO' | 'CANCELADO';
  dadosPagamento?: MpCheckoutData;
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

/**
 * O modo de pagamento é definido por estabelecimento, mas cada reserva guarda um
 * snapshot do modo vigente na sua criação (regra: reservas antigas continuam no
 * modo em que foram criadas).
 */
const modoPagamentoDaReserva = (
  reserva?: {
    modoPagamento?: 'PADRAO' | 'MERCADO_PAGO';
    estabelecimento?: { modoPagamento?: 'PADRAO' | 'MERCADO_PAGO' };
  } | null
): 'PADRAO' | 'MERCADO_PAGO' =>
  reserva?.modoPagamento ?? reserva?.estabelecimento?.modoPagamento ?? 'PADRAO';

export default function GuestReservations() {
  // Selected states
  const [activeTab, setActiveTab] = useState(0); // 0: Tudo, 1: Solicitadas, 2: Confirmadas, 3: Aguardando pagamento, 4: Finalizadas, 5: Canceladas
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

  // Mercado Pago checkout states
  const [mpCheckout, setMpCheckout] = useState<MercadoPagoCheckout | null>(null);
  const [loadingMpCheckout, setLoadingMpCheckout] = useState(false);

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

  const queryClient = useQueryClient();

  // Fetch all guest reservations
  const { data: allReservations = [], isLoading, isError, refetch } = useQuery<Reservation[]>({
    queryKey: GUEST_RESERVATIONS_KEY,
    queryFn: async () => {
      const res = await reservationsApi.getAll({ limit: 1000 });
      const list: Reservation[] = res.data?.data?.data || res.data?.data || res.data || [];

      // Mercado Pago: além do webhook, consultamos a plataforma a cada ciclo.
      // Assim a reserva é reconhecida como paga mesmo se a notificação não
      // alcançar o servidor (ex.: ambiente local).
      const pendentes = list.filter(
        (r) =>
          modoPagamentoDaReserva(r) === 'MERCADO_PAGO' &&
          (r.status === 'CONFIRMADA' || r.status === 'AGUARDANDO_PAGAMENTO')
      );

      if (pendentes.length > 0) {
        const resultados = await Promise.all(
          pendentes.map((r) => paymentsApi.syncMP(r.id).catch(() => null))
        );
        const confirmou = resultados.some((r) => {
          const info = r?.data?.data || r?.data;
          return info?.status === 'CONFIRMADO';
        });
        if (confirmou) {
          const atualizado = await reservationsApi.getAll({ limit: 1000 });
          return (
            atualizado.data?.data?.data || atualizado.data?.data || atualizado.data || list
          );
        }
      }

      return list;
    },
    refetchInterval: 15_000,
    // A lista muda por fora desta tela (estabelecimento confirma, MP reconhece,
    // reserva criada em outra página): ao montar, sempre buscar dados novos em
    // vez de servir cache de até 5 min.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Contagens derivadas das reservas reais (alimentam filtros e indicadores)
  const totalCount = allReservations.length;
  const pendingCount = allReservations.filter((r) => r.status === 'SOLICITADA').length;
  const confirmedCount = allReservations.filter((r) => r.status === 'CONFIRMADA').length;
  const awaitingPaymentCount = allReservations.filter(
    (r) => r.status === 'AGUARDANDO_PAGAMENTO'
  ).length;
  const inProgressCount = confirmedCount + awaitingPaymentCount;
  const finalizedCount = allReservations.filter((r) => r.status === 'FINALIZADA').length;
  const canceledCount = allReservations.filter((r) => r.status === 'CANCELADA').length;

  // Filter reservations based on active tab
  const getFilteredReservations = () => {
    switch (activeTab) {
      case 1:
        return allReservations.filter((r) => r.status === 'SOLICITADA');
      case 2:
        return allReservations.filter((r) => r.status === 'CONFIRMADA');
      case 3:
        return allReservations.filter((r) => r.status === 'AGUARDANDO_PAGAMENTO');
      case 4:
        return allReservations.filter((r) => r.status === 'FINALIZADA');
      case 5:
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
    setMpCheckout(null);
    setSelectedPaymentMethod(reservation.pagamento?.metodo || 'PIX');

    // Fetch refreshed payment details
    let checkoutSolicitado = false;
    try {
      setPaymentLoading(true);
      const res = await paymentsApi.getByReservation(reservation.id);
      const pData = res.data?.data || res.data;
      if (pData) {
        setDetailedPayment(pData);
        setSelectedPaymentMethod(pData.metodo);
        if (modoPagamentoDaReserva(reservation) === 'MERCADO_PAGO') {
          if (pData.dadosPagamento) {
            setMpCheckout({
              paymentId: pData.codigoTransacao,
              metodo: pData.metodo,
              checkout: pData.dadosPagamento,
            });
          }
          if (reservation.status === 'CONFIRMADA' || reservation.status === 'AGUARDANDO_PAGAMENTO') {
            checkoutSolicitado = true;
            createMpCheckout(pData.metodo ?? 'PIX', false, reservation.id);
          }
        } else if (pData.metodo === 'PIX') {
          loadPixDetails(reservation.id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar pagamento da reserva:', err);
    } finally {
      setPaymentLoading(false);
    }

    // Mercado Pago: a reserva pode não ter cobrança criada ainda (o pagamento só
    // é liberado após a aprovação do estabelecimento).
    if (
      !checkoutSolicitado &&
      modoPagamentoDaReserva(reservation) === 'MERCADO_PAGO' &&
      (reservation.status === 'CONFIRMADA' || reservation.status === 'AGUARDANDO_PAGAMENTO')
    ) {
      createMpCheckout(
        reservation.pagamento?.metodo ?? 'PIX',
        false,
        reservation.id
      );
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
    if (
      selectedReservation &&
      modoPagamentoDaReserva(selectedReservation) === 'MERCADO_PAGO'
    ) {
      createMpCheckout(method, false, selectedReservation.id);
      return;
    }
    if (method === 'PIX' && !pixData && selectedReservation) {
      loadPixDetails(selectedReservation.id);
    }
  };

  // Create / retrieve a Mercado Pago checkout for the reservation
  const createMpCheckout = async (
    metodo: 'PIX' | 'BOLETO' | 'CARTAO',
    openLink = false,
    reservationId?: string
  ): Promise<MercadoPagoCheckout | null> => {
    const resId = reservationId || selectedReservation?.id;
    if (!resId) return null;
    try {
      setLoadingMpCheckout(true);
      setSelectedPaymentMethod(metodo);
      const res = await paymentsApi.createCheckoutMP(resId, metodo);
      const data = res.data?.data || res.data;
      if (!data?.checkout) {
        toast.error('Não foi possível gerar o pagamento. Tente novamente.');
        return null;
      }
      const checkout = data.checkout;
      setMpCheckout({
        paymentId: data.paymentId || data.codigoTransacao,
        metodo,
        checkout,
      });
      if (metodo === 'CARTAO' && openLink && checkout.initPoint) {
        window.open(checkout.initPoint, '_blank', 'noopener,noreferrer');
      }
      return { paymentId: data.paymentId || data.codigoTransacao, metodo, checkout };
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Erro ao gerar o pagamento via Mercado Pago.');
      return null;
    } finally {
      setLoadingMpCheckout(false);
    }
  };

  // Open Card (Checkout Pro) in a new tab
  const handleOpenMpCard = async () => {
    if (!selectedReservation) return;
    let checkout = mpCheckout;
    if (!checkout?.checkout?.initPoint) {
      checkout = await createMpCheckout('CARTAO', false, selectedReservation.id);
    }
    if (checkout?.checkout?.initPoint) {
      window.open(checkout.checkout.initPoint, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Não foi possível abrir o checkout. Tente novamente.');
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
    const code = mpCheckout?.checkout?.pixCopyPaste || pixData?.pixCopyPaste;
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success('Código PIX Copia e Cola copiado para a área de transferência!');
    }
  };

  // Copy Boleto barcode
  const handleCopyBoleto = () => {
    const code =
      mpCheckout?.checkout?.boletoBarcode || '34191.79001 01043.513184 91020.150008 7 98760000015000';
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success('Código de barras do boleto copiado!');
    }
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

      toast.success('Pagamento com cartão simulado e aprovado com sucesso!');
      
      // Refresh queries
      void invalidateGuestReservations(queryClient);
      
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
      void invalidateGuestReservations(queryClient);
      
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
    const reservaCancelada = reservationToCancel;
    try {
      setCancelling(true);
      await reservationsApi.cancel(reservaCancelada.id, { motivo: cancelReason });

      // Atualização otimista: o cartão muda de status imediatamente, sem
      // depender do tempo do novo fetch. Em seguida a invalidação reconcilia
      // com o que o servidor realmente gravou.
      queryClient.setQueryData<Reservation[]>(GUEST_RESERVATIONS_KEY, (atuais) =>
        atuais?.map((r) =>
          r.id === reservaCancelada.id ? { ...r, status: 'CANCELADA' as const } : r,
        ),
      );

      toast.success('Reserva cancelada com sucesso.');
      setCancelOpen(false);
      setReservationToCancel(null);
      void invalidateGuestReservations(queryClient);
      if (detailsOpen) {
        setDetailsOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao cancelar reserva');
      // Se o servidor recusou, o cache local pode estar otimista: rebusca.
      void invalidateGuestReservations(queryClient);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        icon={<CalendarMonth />}
        overline="Área do hóspede"
        title="Minhas reservas"
        subtitle="Acompanhe suas solicitações de hospedagem, realize pagamentos e gerencie comprovantes de check-in."
        actions={
          <>
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()} disabled={isLoading}>
              Atualizar
            </Button>
            <Button variant="contained" startIcon={<Search />} href="/busca">
              Buscar hospedagens
            </Button>
          </>
        }
      />

      {/* Indicadores — derivados das reservas reais já carregadas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Todas" value={totalCount} icon={<CalendarMonth />} tone="neutral" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            label="Solicitadas"
            value={pendingCount}
            icon={<WarningAmber />}
            tone="warning"
            hint="Aguardando aprovação"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            label="Em andamento"
            value={inProgressCount}
            icon={<Payment />}
            tone="info"
            hint="Confirmadas ou aguardando pagamento"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Finalizadas" value={finalizedCount} icon={<CheckCircleOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Canceladas" value={canceledCount} icon={<CancelOutlined />} tone="error" />
        </Grid>
      </Grid>

      {/* Filtros por status — contagem sempre derivada das reservas reais */}
      <SectionCard noPadding sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Filtrar reservas por status"
          sx={{ px: 1, borderBottom: 0 }}
        >
          <Tab label={`Tudo (${totalCount})`} />
          <Tab label={`Solicitadas (${pendingCount})`} />
          <Tab label={`Confirmadas (${confirmedCount})`} />
          <Tab label={`Aguardando pagamento (${awaitingPaymentCount})`} />
          <Tab label={`Finalizadas (${finalizedCount})`} />
          <Tab label={`Canceladas (${canceledCount})`} />
        </Tabs>
      </SectionCard>

      {isLoading ? (
        <PageLoading label="Carregando suas reservas…" minHeight="40vh" />
      ) : isError && totalCount === 0 ? (
        <ErrorState
          title="Não foi possível carregar suas reservas"
          description="Ocorreu uma falha na comunicação. Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
        />
      ) : filteredReservations.length === 0 ? (
        <EmptyState
          icon={<CalendarMonth />}
          title={totalCount === 0 ? 'Você ainda não tem reservas' : 'Nenhuma reserva neste filtro'}
          description={
            totalCount === 0
              ? 'Quando você solicitar uma hospedagem, ela aparecerá aqui para acompanhamento.'
              : 'Ajuste o filtro para ver suas reservas em outros status.'
          }
          action={
            <Button variant="contained" href="/busca">
              Buscar hospedagens
            </Button>
          }
        />
      ) : (
        <>
          <Grid container spacing={3}>
            {paginatedReservations.map((reservation) => {
              const coverPhoto =
                reservation.estabelecimento?.fotos?.find((f) => f.isCapa)?.url ||
                reservation.estabelecimento?.fotos?.[0]?.url ||
                '';

              const nights = Math.max(
                1,
                dayjs(reservation.checkOut).diff(dayjs(reservation.checkIn), 'day')
              );
              const podeCancelar =
                reservation.status === 'SOLICITADA' ||
                reservation.status === 'CONFIRMADA' ||
                reservation.status === 'AGUARDANDO_PAGAMENTO';

              return (
                <Grid key={reservation.id} size={{ xs: 12, md: 6 }}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: 'border-color 180ms, box-shadow 180ms',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
                    }}
                  >
                    <Box
                      sx={(t) => ({
                        position: 'relative',
                        height: 180,
                        flexShrink: 0,
                        background: coverPhoto
                          ? undefined
                          : `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.9)} 0%, ${alpha(
                              t.palette.secondary.main,
                              0.78
                            )} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.contrastText',
                      })}
                    >
                      {coverPhoto ? (
                        <Box
                          component="img"
                          src={coverPhoto}
                          alt={`Foto de ${reservation.estabelecimento?.nome || 'estabelecimento'}`}
                          loading="lazy"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <Hotel aria-hidden sx={{ fontSize: 44, opacity: 0.9 }} />
                      )}
                      <StatusChip
                        status={reservation.status}
                        sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'background.paper' }}
                      />
                    </Box>

                    <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, p: 2.5 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                        >
                          #{reservation.codigoReserva}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {dayjs(reservation.criadoEm).format('DD MMM YYYY, HH:mm')}
                        </Typography>
                      </Box>

                      <Typography
                        variant="h6"
                        component="h2"
                        sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
                      >
                        {reservation.estabelecimento?.nome || 'Estabelecimento'}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}
                      >
                        <LocationOn aria-hidden sx={{ fontSize: 16 }} />
                        {reservation.estabelecimento?.cidade?.nome} -{' '}
                        {reservation.estabelecimento?.cidade?.estado}
                      </Typography>

                      <Divider sx={{ mb: 1.5 }} />

                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        {reservation.quarto?.nome || 'Quarto'}
                      </Typography>

                      <InfoGrid columns={2} sx={{ mb: 2 }}>
                        <InfoItem
                          label="Período"
                          icon={<CalendarMonth sx={{ fontSize: 14 }} />}
                          value={
                            <>
                              {formatDate(reservation.checkIn)} a {formatDate(reservation.checkOut)}{' '}
                              <Typography component="span" variant="caption" color="textSecondary">
                                ({nights} {nights === 1 ? 'noite' : 'noites'})
                              </Typography>
                            </>
                          }
                        />
                        <InfoItem
                          label="Hóspedes"
                          icon={<People sx={{ fontSize: 14 }} />}
                          value={`${reservation.adultos} adulto${
                            reservation.adultos === 1 ? '' : 's'
                          }${
                            reservation.criancas > 0
                              ? ` · ${reservation.criancas} criança${
                                  reservation.criancas === 1 ? '' : 's'
                                }`
                              : ''
                          }`}
                        />
                      </InfoGrid>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          mt: 'auto',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            Valor total
                          </Typography>
                          <Typography variant="h6" component="p" sx={{ fontWeight: 800 }}>
                            {formatCurrency(reservation.valorTotal)}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <ModoPagamentoChip modo={modoPagamentoDaReserva(reservation)} />
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            flexGrow: { xs: 1, sm: 0 },
                            justifyContent: 'flex-end',
                          }}
                        >
                          {podeCancelar && (
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
                            size="small"
                            onClick={() => handleOpenDetails(reservation)}
                          >
                            {reservation.status === 'CONFIRMADA' ||
                            reservation.status === 'AGUARDANDO_PAGAMENTO'
                              ? 'Pagar / Detalhes'
                              : 'Ver detalhes'}
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

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
            sx={{ mt: 3, '.MuiTablePagination-toolbar': { flexWrap: 'wrap', rowGap: 1 } }}
          />
        </>
      )}

      {/* Confirmação de cancelamento */}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar reserva"
        description={
          <>
            Você tem certeza que deseja cancelar sua reserva{' '}
            <strong>{reservationToCancel?.codigoReserva}</strong> no{' '}
            <strong>{reservationToCancel?.estabelecimento?.nome}</strong>? Esta ação é
            irreversível.
          </>
        }
        confirmLabel="Confirmar cancelamento"
        cancelLabel="Voltar"
        tone="error"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelOpen(false)}
      >
        <TextField
          autoFocus
          margin="dense"
          label="Motivo do cancelamento (opcional)"
          fullWidth
          variant="outlined"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          sx={{ mt: 1 }}
        />
      </ConfirmDialog>

      {/* Detalhes da reserva + pagamento */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="span" sx={{ display: 'block', fontWeight: 700 }}>
              Detalhes da reserva
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {selectedReservation && <StatusChip status={selectedReservation.status} />}
              {selectedReservation && (
                <ModoPagamentoChip modo={modoPagamentoDaReserva(selectedReservation)} />
              )}
              <Typography variant="caption" color="textSecondary">
                Código {selectedReservation?.codigoReserva}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setDetailsOpen(false)} aria-label="Fechar detalhes da reserva">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          {selectedReservation && (
            <Grid container spacing={3}>
              {/* Coluna esquerda: dados da reserva */}
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Informações gerais" contentSx={{ p: 2.5 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                      Hospedagem
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {selectedReservation.estabelecimento.nome}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedReservation.estabelecimento.endereco} -{' '}
                      {selectedReservation.estabelecimento.cidade.nome},{' '}
                      {selectedReservation.estabelecimento.cidade.estado}
                    </Typography>
                  </Box>

                  <InfoGrid columns={2} sx={{ mb: 2 }}>
                    <InfoItem
                      label="Check-in"
                      value={formatDate(selectedReservation.checkIn)}
                      emphasis
                    />
                    <InfoItem
                      label="Check-out"
                      value={formatDate(selectedReservation.checkOut)}
                      emphasis
                    />
                    <InfoItem
                      label="Noites"
                      value={dayjs(selectedReservation.checkOut).diff(
                        dayjs(selectedReservation.checkIn),
                        'day'
                      )}
                    />
                    <InfoItem
                      label="Hóspedes"
                      value={`${selectedReservation.adultos} adulto${
                        selectedReservation.adultos === 1 ? '' : 's'
                      }${
                        selectedReservation.criancas > 0
                          ? ` · ${selectedReservation.criancas} criança${
                              selectedReservation.criancas === 1 ? '' : 's'
                            }`
                          : ''
                      }`}
                    />
                  </InfoGrid>

                  <Box sx={{ mb: selectedReservation.quarto.fotos?.length ? 2 : 0 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                      Acomodação
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {selectedReservation.quarto.nome}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Capacidade máxima: {selectedReservation.quarto.capacidade} pessoas
                    </Typography>
                  </Box>

                  {selectedReservation.quarto.fotos && selectedReservation.quarto.fotos.length > 0 && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 1,
                        mb: 2,
                      }}
                    >
                      {selectedReservation.quarto.fotos.map((foto) => (
                        <Box
                          key={foto.id}
                          component="img"
                          src={foto.url}
                          alt={`Foto de ${selectedReservation.quarto.nome}`}
                          loading="lazy"
                          sx={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 1.5 }}
                        />
                      ))}
                    </Box>
                  )}

                  {selectedReservation.observacoes && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Observações
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        “{selectedReservation.observacoes}”
                      </Typography>
                    </Box>
                  )}
                </SectionCard>

                <SectionCard
                  title="Contato do estabelecimento"
                  sx={{ mt: 3 }}
                  contentSx={{ p: 2.5 }}
                >
                  {selectedReservation.estabelecimento.contato && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Phone aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">
                        {selectedReservation.estabelecimento.contato}
                      </Typography>
                    </Box>
                  )}
                  {selectedReservation.estabelecimento.emailContato && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Email aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">
                        {selectedReservation.estabelecimento.emailContato}
                      </Typography>
                    </Box>
                  )}
                  {selectedReservation.estabelecimento.website && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <OpenInNew aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
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
                        sx={{ color: 'primary.main', fontWeight: 600 }}
                      >
                        Visitar site
                      </Typography>
                    </Box>
                  )}
                  {!selectedReservation.estabelecimento.contato &&
                    !selectedReservation.estabelecimento.emailContato &&
                    !selectedReservation.estabelecimento.website && (
                      <Typography variant="body2" color="textSecondary">
                        O estabelecimento não informou canais de contato adicionais.
                      </Typography>
                    )}
                </SectionCard>
              </Grid>

              {/* Coluna direita: pagamento e status */}
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Pagamento" contentSx={{ p: 2.5 }}>
                  <InfoRow
                    label="Valor total"
                    value={formatCurrency(selectedReservation.valorTotal)}
                    emphasis
                  />
                  <Divider sx={{ my: 2 }} />

                  {/* Fluxo 1: solicitação aguardando aprovação */}
                  {selectedReservation.status === 'SOLICITADA' && (
                    <Alert severity="info" icon={<WarningAmber />}>
                      Esta reserva foi solicitada e está aguardando a análise do estabelecimento.
                      Assim que for pré-aprovada, as informações de pagamento serão liberadas.
                    </Alert>
                  )}

                  {/* Fluxo 2: reserva cancelada */}
                  {selectedReservation.status === 'CANCELADA' && (
                    <Box>
                      <Alert severity="error" icon={<CancelOutlined />} sx={{ mb: 2 }}>
                        Reserva cancelada.
                      </Alert>
                      {selectedReservation.cancelamentoMotivo && (
                        <Box
                          sx={(t) => ({
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(
                              t.palette.error.main,
                              t.palette.mode === 'dark' ? 0.16 : 0.08
                            ),
                            border: '1px solid',
                            borderColor: alpha(t.palette.error.main, 0.24),
                          })}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                            Motivo do cancelamento
                          </Typography>
                          <Typography variant="body2">
                            {selectedReservation.cancelamentoMotivo}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Fluxo 3: reserva finalizada */}
                  {selectedReservation.status === 'FINALIZADA' && (
                    <Box>
                      <Alert severity="success" icon={<CheckCircleOutlined />} sx={{ mb: 2 }}>
                        Pagamento recebido e reserva finalizada.
                      </Alert>
                      {detailedPayment && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                            Detalhes do pagamento
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Método: {detailedPayment.metodo}
                          </Typography>
                          {detailedPayment.codigoTransacao && (
                            <Typography variant="body2" color="textSecondary">
                              Transação: {detailedPayment.codigoTransacao}
                            </Typography>
                          )}
                          {detailedPayment.comprovanteUrl && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ReceiptLong />}
                              href={detailedPayment.comprovanteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ mt: 2 }}
                            >
                              Ver comprovante
                            </Button>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Fluxo 4: confirmada / aguardando pagamento */}
                  {(selectedReservation.status === 'CONFIRMADA' ||
                    selectedReservation.status === 'AGUARDANDO_PAGAMENTO') && (
                    <Box>
                      {detailedPayment?.status === 'CONFIRMADO' || detailedPayment?.comprovanteUrl ? (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <CheckCircleOutlined
                            color="success"
                            aria-hidden
                            sx={{ fontSize: 48, mb: 1 }}
                          />
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700, color: 'success.main' }}
                          >
                            Comprovante enviado
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                            O estabelecimento está analisando o recibo do seu pagamento. Você será
                            notificado assim que for compensado.
                          </Typography>
                          {detailedPayment?.comprovanteUrl && (
                            <Button
                              variant="outlined"
                              startIcon={<ReceiptLong />}
                              href={detailedPayment.comprovanteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Visualizar comprovante
                            </Button>
                          )}
                        </Box>
                      ) : (
                        // Opções de pagamento (cartão simulado preservado — ver R-17)
                        <Box>
                          <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 3 }}>
                            {modoPagamentoDaReserva(selectedReservation) === 'MERCADO_PAGO'
                              ? 'Aguardando seu pagamento via Mercado Pago para consolidar a hospedagem.'
                              : 'Aguardando seu pagamento para consolidar a hospedagem. Escolha a forma de pagamento abaixo.'}
                          </Alert>

                          {/* Seleção do método de pagamento */}
                          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                            {(['PIX', 'BOLETO', 'CARTAO'] as const).map((method) => (
                              <Button
                                key={method}
                                variant={selectedPaymentMethod === method ? 'contained' : 'outlined'}
                                onClick={() => handlePaymentMethodChange(method)}
                                size="small"
                                aria-pressed={selectedPaymentMethod === method}
                                sx={{ flexGrow: 1 }}
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

                          {/* PIX */}
                          {!paymentLoading && selectedPaymentMethod === 'PIX' && (
                            <Box>
                              {modoPagamentoDaReserva(selectedReservation) === 'MERCADO_PAGO' ? (
                                loadingMpCheckout && !mpCheckout?.checkout?.qrCodeBase64 ? (
                                  <Box sx={{ py: 3 }}>
                                    <LinearProgress />
                                  </Box>
                                ) : mpCheckout?.checkout?.qrCodeBase64 ? (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      mb: 3,
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      src={
                                        mpCheckout.checkout.qrCodeBase64.startsWith('data:')
                                          ? mpCheckout.checkout.qrCodeBase64
                                          : `data:image/png;base64,${mpCheckout.checkout.qrCodeBase64}`
                                      }
                                      alt="QR Code Pix do Mercado Pago"
                                      sx={{
                                        width: 180,
                                        height: 180,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1,
                                        mb: 2,
                                        bgcolor: 'background.paper',
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ mb: 2, textAlign: 'center' }}
                                    >
                                      Escaneie o QR Code com o app do seu banco ou use o código Pix
                                      Copia e Cola abaixo.
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<ContentCopy />}
                                      onClick={handleCopyPix}
                                      fullWidth
                                    >
                                      Copiar código Pix Copia e Cola
                                    </Button>
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ mt: 1.5, textAlign: 'center' }}
                                    >
                                      O pagamento será confirmado automaticamente assim que for
                                      compensado.
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Box sx={{ py: 3 }}>
                                    <LinearProgress />
                                  </Box>
                                )
                              ) : loadingPix ? (
                                <Box sx={{ py: 3 }}>
                                  <LinearProgress />
                                </Box>
                              ) : (
                                pixData && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      mb: 3,
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      src={pixData.qrCode}
                                      alt="QR Code Pix para pagamento"
                                      sx={{
                                        width: 160,
                                        height: 160,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1,
                                        mb: 2,
                                        bgcolor: 'background.paper',
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ mb: 2, textAlign: 'center' }}
                                    >
                                      Escaneie o código com o app do seu banco ou use a chave abaixo.
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<ContentCopy />}
                                      onClick={handleCopyPix}
                                      fullWidth
                                    >
                                      Copiar código Pix Copia e Cola
                                    </Button>
                                  </Box>
                                )
                              )}
                            </Box>
                          )}

                          {/* BOLETO */}
                          {!paymentLoading && selectedPaymentMethod === 'BOLETO' && (
                            <Box sx={{ mb: 3 }}>
                              {modoPagamentoDaReserva(selectedReservation) === 'MERCADO_PAGO' ? (
                                <>
                                  <Box
                                    sx={{
                                      p: 2.5,
                                      mb: 2,
                                      borderRadius: 2,
                                      bgcolor: 'action.hover',
                                      border: '1px dashed',
                                      borderColor: 'divider',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Linha digitável do boleto
                                    </Typography>
                                    {mpCheckout?.checkout?.boletoBarcode ? (
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
                                        {mpCheckout.checkout.boletoBarcode}
                                      </Typography>
                                    ) : loadingMpCheckout ? (
                                      <Box sx={{ py: 2 }}>
                                        <LinearProgress />
                                      </Box>
                                    ) : (
                                      <Typography
                                        variant="body2"
                                        color="textSecondary"
                                        sx={{ my: 1.5 }}
                                      >
                                        Aguardando a geração do boleto…
                                      </Typography>
                                    )}
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ display: 'block' }}
                                    >
                                      Vencimento: em até 3 dias úteis.
                                    </Typography>
                                  </Box>
                                  {mpCheckout?.checkout?.boletoUrl && (
                                    <Button
                                      component="a"
                                      href={mpCheckout.checkout.boletoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="contained"
                                      size="small"
                                      startIcon={<OpenInNew />}
                                      fullWidth
                                      sx={{ mb: 1.5 }}
                                    >
                                      Abrir boleto no banco
                                    </Button>
                                  )}
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ContentCopy />}
                                    onClick={handleCopyBoleto}
                                    fullWidth
                                  >
                                    Copiar linha digitável
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Box
                                    sx={{
                                      p: 2.5,
                                      mb: 2,
                                      borderRadius: 2,
                                      bgcolor: 'action.hover',
                                      border: '1px dashed',
                                      borderColor: 'divider',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      Linha digitável do boleto
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
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      sx={{ display: 'block' }}
                                    >
                                      Vencimento: em até 3 dias úteis.
                                    </Typography>
                                  </Box>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ContentCopy />}
                                    onClick={handleCopyBoleto}
                                    fullWidth
                                  >
                                    Copiar linha digitável
                                  </Button>
                                </>
                              )}
                            </Box>
                          )}

                          {/* CARTÃO */}
                          {!paymentLoading && selectedPaymentMethod === 'CARTAO' && (
                            <Box sx={{ mb: 3 }}>
                              {modoPagamentoDaReserva(selectedReservation) === 'MERCADO_PAGO' ? (
                                <>
                                  <Alert severity="info" icon={<Payment />} sx={{ mb: 2 }}>
                                    Você será redirecionado para o ambiente seguro do Mercado Pago
                                    para pagar com cartão de crédito.
                                  </Alert>
                                  <Button
                                    variant="contained"
                                    fullWidth
                                    disabled={loadingMpCheckout}
                                    onClick={handleOpenMpCard}
                                    startIcon={!loadingMpCheckout ? <Payment /> : undefined}
                                  >
                                    {loadingMpCheckout ? (
                                      <CircularProgress size={20} color="inherit" />
                                    ) : (
                                      'Pagar com Cartão via Mercado Pago'
                                    )}
                                  </Button>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    sx={{ mt: 1.5, textAlign: 'center', display: 'block' }}
                                  >
                                    Depois de pagar, volte a esta página para ver o status atualizado.
                                  </Typography>
                                </>
                              ) : (
                                <>
                                  {/*
                                   * Formulário de cartão simulado — risco R-17 em aberto.
                                   * Comportamento preservado: apenas reestilização.
                                   */}
                                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                                    <Grid size={{ xs: 12 }}>
                                      <TextField
                                        label="Nome do Titular"
                                        size="small"
                                        fullWidth
                                        value={cardName}
                                        onChange={(e) => setCardName(e.target.value)}
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
                                      />
                                    </Grid>
                                  </Grid>
                                  <Button
                                    variant="contained"
                                    color="secondary"
                                    fullWidth
                                    disabled={cardSubmitting}
                                    onClick={handleCreditCardPay}
                                  >
                                    {cardSubmitting ? (
                                      <CircularProgress size={20} color="inherit" />
                                    ) : (
                                      'Simular Pagamento com Cartão'
                                    )}
                                  </Button>
                                </>
                              )}
                            </Box>
                          )}

                          {modoPagamentoDaReserva(selectedReservation) !== 'MERCADO_PAGO' &&
                            (selectedPaymentMethod === 'PIX' ||
                              selectedPaymentMethod === 'BOLETO') && (
                              <>
                                <Divider sx={{ my: 3 }} />

                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                                  Enviar comprovante (obrigatório para{' '}
                                  {selectedPaymentMethod === 'PIX' ? 'PIX' : 'boleto'})
                                </Typography>

                                <Box
                                  component="label"
                                  sx={{
                                    border: '2px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 3,
                                    textAlign: 'center',
                                    bgcolor: 'action.hover',
                                    cursor: 'pointer',
                                    transition: 'border-color 180ms, background-color 180ms',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 100,
                                    '&:hover': {
                                      borderColor: 'primary.main',
                                      bgcolor: 'action.selected',
                                    },
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    hidden
                                    onChange={handleFileChange}
                                    aria-label="Selecionar comprovante de pagamento"
                                  />
                                  <CloudUpload
                                    color="primary"
                                    aria-hidden
                                    sx={{ fontSize: 36, mb: 1 }}
                                  />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {selectedFile
                                      ? selectedFile.name
                                      : 'Clique para selecionar o arquivo'}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    sx={{ mt: 0.5 }}
                                  >
                                    Suporta imagens (PNG, JPG) ou PDFs de até 5MB.
                                  </Typography>
                                </Box>

                                {selectedFile && (
                                  <Button
                                    variant="contained"
                                    fullWidth
                                    sx={{ mt: 2 }}
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
                              </>
                            )}
                        </Box>
                      )}
                    </Box>
                  )}
                </SectionCard>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 } }}>
          {selectedReservation &&
            (selectedReservation.status === 'SOLICITADA' ||
              selectedReservation.status === 'CONFIRMADA' ||
              selectedReservation.status === 'AGUARDANDO_PAGAMENTO') && (
              <Button
                color="error"
                variant="outlined"
                onClick={() => handleOpenCancel(selectedReservation)}
              >
                Cancelar reserva
              </Button>
            )}
          <Button onClick={() => setDetailsOpen(false)} variant="contained">
            Fechar detalhes
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
