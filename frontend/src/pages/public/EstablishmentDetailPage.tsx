import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alpha } from '@mui/material/styles';
import {
  Box, Button, ButtonBase, Typography, TextField,
  Card, CardContent, Rating, Chip, Avatar,
  Skeleton, IconButton, Divider,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, Alert,
} from '@mui/material';
import {
  Wifi, Pool, LocalParking, FreeBreakfast, Tv, AcUnit, Kitchen, Pets,
  FitnessCenter, LocalBar, Restaurant, RoomService, Star, LocationOn,
  Phone, ArrowBack, ChevronLeft, ChevronRight, People, AccountBalanceWallet,
  ContentCopy, CheckCircle, CreditCard, Receipt, Email, Close, RateReviewOutlined,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { establishmentsApi, roomsApi, reservationsApi, paymentsApi, regrasApi, reviewsApi } from '../../services/api';
import { invalidateGuestReservations } from '../../services/queryKeys';
import { FavoriteButton } from '../../components/favorites/FavoriteButton';
import { useAuthStore } from '../../stores/authStore';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  EmptyState,
  ErrorState,
  ModoPagamentoChip,
  InfoGrid,
  InfoItem,
  InfoRow,
  FormGrid,
  MediaFallback,
} from '../../components/common';
import { radius, formatCurrency, formatDate } from '../../theme/tokens';

// Fix Leaflet marker icon asset paths in Vite
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Map amenity name to icon
const AMENITY_ICONS: Record<string, React.ReactElement> = {
  'Wi-Fi': <Wifi />,
  'Wifi': <Wifi />,
  'Piscina': <Pool />,
  'Estacionamento': <LocalParking />,
  'Café da manhã': <FreeBreakfast />,
  'Café da Manhã': <FreeBreakfast />,
  'TV': <Tv />,
  'Ar condicionado': <AcUnit />,
  'Ar Condicionado': <AcUnit />,
  'Frigobar': <Kitchen />,
  'Pet friendly': <Pets />,
  'Pet Friendly': <Pets />,
  'Academia': <FitnessCenter />,
  'Bar': <LocalBar />,
  'Restaurante': <Restaurant />,
  'Serviço de quarto': <RoomService />,
};

// Map controller to adjust view dynamically
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function EstablishmentDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();

  // Booking states
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [adults, setAdults] = useState<string | number>(1);
  const [children, setChildren] = useState<string | number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CARTAO' | 'BOLETO'>('PIX');

  // Interactive gallery state
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Room photo gallery state
  const [roomGalleryOpen, setRoomGalleryOpen] = useState(false);
  const [roomGalleryPhotos, setRoomGalleryPhotos] = useState<any[]>([]);
  const [roomGalleryIndex, setRoomGalleryIndex] = useState(0);

  // Success Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [pixData, setPixData] = useState<any>(null);
  const [mpCheckout, setMpCheckout] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card details states (for CC simulation)
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardSimulated, setCardSimulated] = useState(false);

  // Query details
  const { data: establishment, isLoading, error, refetch } = useQuery({
    queryKey: ['establishmentDetail', id],
    queryFn: () => establishmentsApi.getOne(id!).then(res => res.data.data),
    enabled: !!id,
  });

  // Query regras
  const { data: regras } = useQuery({
    queryKey: ['establishmentRegras', id],
    queryFn: () => regrasApi.getByEstablishment(id!).then(res => res.data.data || res.data || []),
    enabled: !!id,
  });

  // Automatically select the first room if available when rooms load
  useEffect(() => {
    if (establishment?.quartos && establishment.quartos.length > 0) {
      setSelectedRoomId(establishment.quartos[0].id);
    }
  }, [establishment]);

  // Validations for dates
  const isDatesValid = Boolean(checkIn && checkOut && new Date(checkIn) < new Date(checkOut));

  // Query price calculation
  const { data: priceData, isLoading: isLoadingPrice } = useQuery({
    queryKey: ['roomPrice', selectedRoomId, checkIn, checkOut],
    queryFn: async (): Promise<number> => {
      const res = await roomsApi.calculatePrice(selectedRoomId, checkIn, checkOut);
      return res.data.data;
    },
    enabled: !!selectedRoomId && isDatesValid,
  });

  // Query availability check
  const { data: availabilityData, isLoading: isLoadingAvailability } = useQuery({
    queryKey: ['roomAvailability', selectedRoomId, checkIn, checkOut],
    queryFn: async (): Promise<{
      disponivel: boolean;
      reservasConflitantes: number;
      datasBlockadas: number;
    }> => {
      const res = await roomsApi.checkAvailability(selectedRoomId, checkIn, checkOut);
      return res.data.data;
    },
    enabled: !!selectedRoomId && isDatesValid,
  });

  // Query avaliações (endpoint público de leitura)
  const {
    data: avaliacoes,
    isLoading: isLoadingReviews,
    error: reviewsError,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: ['establishmentReviews', id],
    queryFn: () => reviewsApi.getByEstablishment(id!).then(res => res.data.data || res.data || []),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <PageContainer maxWidth="content">
        <Skeleton variant="text" width="18%" height={24} sx={{ mb: 2.5 }} />
        <Skeleton variant="text" width="60%" height={48} />
        <Skeleton variant="text" width="38%" height={24} sx={{ mb: 3 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 384px' },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Skeleton variant="rounded" height={240} sx={{ display: { xs: 'block', md: 'none' } }} />
            <Skeleton variant="rounded" height={420} sx={{ display: { xs: 'none', md: 'block' } }} />
            <Skeleton variant="rounded" height={180} />
            <Skeleton variant="rounded" height={240} />
          </Box>
          <Skeleton variant="rounded" height={420} sx={{ display: { xs: 'none', md: 'block' } }} />
        </Box>
      </PageContainer>
    );
  }

  if (error || !establishment) {
    return (
      <PageContainer maxWidth="form">
        <ErrorState
          title="Não foi possível carregar os detalhes do estabelecimento."
          description="Verifique sua conexão e tente novamente. Se o problema continuar, volte para a busca."
          onRetry={() => refetch()}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/busca')}>
            Voltar para a busca
          </Button>
        </Box>
      </PageContainer>
    );
  }

  // Gallery Photos
  const photos = establishment.fotos && establishment.fotos.length > 0
    ? [...establishment.fotos].sort((a: any, b: any) => a.ordem - b.ordem)
    : establishment.fotoPerfil
      ? [{ url: establishment.fotoPerfil }]
      : [];

  const activePhotoUrl = photos[activePhotoIndex]?.url;

  const selectedRoom = establishment.quartos?.find((r: any) => r.id === selectedRoomId);

  // Dates helpers
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  // Calculate nights
  const nights = isDatesValid
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Handle booking form submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoomId) {
      toast.error('Por favor, selecione uma acomodação.');
      return;
    }
    if (!isDatesValid) {
      toast.error('Selecione datas de check-in e check-out válidas.');
      return;
    }
    if (availabilityData && !availabilityData.disponivel) {
      toast.error('Este quarto não está disponível para o período selecionado.');
      return;
    }
    if (selectedRoom && (Number(adults) + Number(children)) > selectedRoom.capacidade) {
      toast.error(`A capacidade máxima deste quarto é de ${selectedRoom.capacidade} pessoas.`);
      return;
    }

    if (!isAuthenticated) {
      toast.error('Você precisa fazer login para solicitar uma reserva.');
      navigate(`/login?redirect=/hospedagem/${id}`);
      return;
    }

    if (user?.role === 'ESTABLISHMENT') {
      toast.error('Contas de proprietário não podem solicitar reservas.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create reservation
      const resReserva = await reservationsApi.create({
        estabelecimentoId: id,
        quartoId: selectedRoomId,
        checkIn,
        checkOut,
        adultos: Number(adults) || 1,
        criancas: Number(children) || 0,
        observacoes: 'Reserva efetuada pelo painel de detalhes.',
      });

      const reserva = resReserva.data.data;
      setCreatedReservation(reserva);

      // A reserva nasce aqui: marca a lista de "Minhas Reservas" como
      // desatualizada para ela aparecer sem precisar de F5.
      void invalidateGuestReservations(queryClient);

      const isMpMode =
        (reserva.modoPagamento ?? reserva.estabelecimento?.modoPagamento) === 'MERCADO_PAGO';

      if (isMpMode) {
        // Mercado Pago: a cobrança só é liberada depois que o estabelecimento
        // aprovar a solicitação — o hóspede paga em "Minhas Reservas".
        setMpCheckout(null);
      } else {
        // 2. Create Payment choice
        await paymentsApi.create({
          reservaId: reserva.id,
          metodo: paymentMethod,
        });

        // 3. Generate PIX if chosen
        if (paymentMethod === 'PIX') {
          const resPix = await paymentsApi.generatePix(reserva.id);
          setPixData(resPix.data.data);
        }
      }

      setSuccessDialogOpen(true);
      toast.success('Solicitação de reserva criada com sucesso!');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Falha ao solicitar reserva. Tente novamente.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRoomGallery = (photos: any[], index: number) => {
    setRoomGalleryPhotos(photos);
    setRoomGalleryIndex(index);
    setRoomGalleryOpen(true);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleSimulateCreditCard = () => {
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os campos do cartão para simular.');
      return;
    }
    setCardSimulated(true);
    toast.success('Transação com cartão de crédito simulada com sucesso!');
  };

  const handleOpenMpCheckout = () => {
    const initPoint = mpCheckout?.checkout?.initPoint;
    if (initPoint) {
      window.open(initPoint, '_blank', 'noopener,noreferrer');
    }
  };

  const isMpEstabelecimento =
    (createdReservation?.modoPagamento ?? establishment?.modoPagamento) === 'MERCADO_PAGO';

  const cidadeUF = [establishment.cidade?.nome, establishment.cidade?.estado]
    .filter(Boolean)
    .join(' · ');

  return (
    <PageContainer maxWidth="content">
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(-1)}
        sx={{ mb: { xs: 2, md: 2.5 }, ml: -0.5, fontWeight: 600, color: 'text.secondary' }}
      >
        Voltar
      </Button>

      {/* ================= CABEÇALHO ================= */}
      <PageHeader
        title={establishment.nome}
        overline={cidadeUF || undefined}
        subtitle={establishment.endereco || cidadeUF || 'Localização não informada'}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FavoriteButton
              estabelecimentoId={establishment.id}
              nome={establishment.nome}
              variant="labeled"
            />
            {establishment.totalAvaliacoes > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Star aria-hidden sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {Number(establishment.notaMedia).toFixed(1)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  ({establishment.totalAvaliacoes}{' '}
                  {establishment.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Sem avaliações ainda
              </Typography>
            )}
            <ModoPagamentoChip modo={establishment.modoPagamento} size="medium" />
          </Box>
        }
      />

      {establishment.comodidades && establishment.comodidades.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: { xs: 2.5, md: 3 } }}>
          {establishment.comodidades.slice(0, 6).map((item: any) => (
            <Chip
              key={item.comodidade.id}
              size="small"
              variant="outlined"
              icon={AMENITY_ICONS[item.comodidade.nome] || <Wifi />}
              label={item.comodidade.nome}
            />
          ))}
          {establishment.comodidades.length > 6 && (
            <Chip
              size="small"
              variant="outlined"
              label={`+${establishment.comodidades.length - 6} comodidades`}
            />
          )}
        </Box>
      )}

      {/* ================= LAYOUT EM 2 COLUNAS ================= */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 384px' },
          gridTemplateAreas: {
            xs: '"galeria" "reserva" "conteudo"',
            md: '"galeria reserva" "conteudo reserva"',
          },
          gap: { xs: 2.5, md: 3 },
        }}
      >
        {/* ================= GALERIA ================= */}
        <Box sx={{ gridArea: 'galeria', minWidth: 0, alignSelf: 'start' }}>
          <Box
            sx={{
              position: 'relative',
              p: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: `${radius.xl}px`,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: { xs: 'block', md: 'grid' },
                gridTemplateColumns:
                  photos.length > 1 ? 'minmax(0, 2fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
                gridTemplateRows: photos.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'auto',
                gap: 1,
              }}
            >
              <ButtonBase
                onClick={() => {
                  if (photos.length > 0) handleOpenRoomGallery(photos, activePhotoIndex);
                }}
                aria-label={
                  photos.length > 0
                    ? `Ampliar foto de ${establishment.nome}`
                    : `Sem foto disponível de ${establishment.nome}`
                }
                sx={{
                  display: 'block',
                  width: '100%',
                  gridColumn: { md: '1' },
                  gridRow: { md: photos.length > 1 ? '1 / 3' : '1' },
                  borderRadius: `${radius.md}px`,
                  overflow: 'hidden',
                  cursor: photos.length > 0 ? 'pointer' : 'default',
                }}
              >
                {activePhotoUrl ? (
                  <Box
                    component="img"
                    src={activePhotoUrl}
                    alt={`${establishment.nome} — foto ${activePhotoIndex + 1} de ${photos.length}`}
                    sx={{
                      width: '100%',
                      height: { xs: 240, sm: 320, md: 420 },
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <MediaFallback
                    variant="establishment"
                    label={establishment.nome}
                    size="lg"
                    sx={{ height: { xs: 240, sm: 320, md: 420 } }}
                  />
                )}
              </ButtonBase>

              {photos.length > 1 &&
                photos.slice(1, 3).map((photo: any, idx: number) => (
                  <ButtonBase
                    key={photo.id || idx}
                    onClick={() => setActivePhotoIndex(idx + 1)}
                    aria-label={`Ver foto ${idx + 2} de ${photos.length}`}
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      gridColumn: { md: '2' },
                      gridRow: { md: `${idx + 1}` },
                      borderRadius: `${radius.md}px`,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={photo.url}
                      alt={`${establishment.nome} — foto ${idx + 2}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </ButtonBase>
                ))}
            </Box>

            {photos.length > 1 && (
              <Button
                size="small"
                onClick={() => handleOpenRoomGallery(photos, activePhotoIndex)}
                sx={(t) => ({
                  position: 'absolute',
                  right: 20,
                  bottom: 20,
                  bgcolor: alpha(t.palette.common.black, 0.62),
                  color: t.palette.common.white,
                  border: `1px solid ${alpha(t.palette.common.white, 0.24)}`,
                  '&:hover': { bgcolor: alpha(t.palette.common.black, 0.8) },
                })}
              >
                Ver {photos.length} fotos
              </Button>
            )}
          </Box>

          {/* Faixa de miniaturas (mobile/tablet) */}
          {photos.length > 1 && (
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                gap: 1,
                mt: 1.5,
                overflowX: 'auto',
                pb: 0.5,
              }}
            >
              {photos.map((photo: any, index: number) => (
                <ButtonBase
                  key={photo.id || index}
                  onClick={() => setActivePhotoIndex(index)}
                  aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                  sx={{
                    flexShrink: 0,
                    width: 84,
                    height: 60,
                    borderRadius: `${radius.sm}px`,
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: activePhotoIndex === index ? 'primary.main' : 'transparent',
                    opacity: activePhotoIndex === index ? 1 : 0.72,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Box
                    component="img"
                    src={photo.url}
                    alt={`${establishment.nome} — miniatura ${index + 1}`}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>

        {/* ================= COLUNA DE CONTEÚDO ================= */}
        <Box
          sx={{
            gridArea: 'conteudo',
            minWidth: 0,
            alignSelf: 'start',
            display: 'grid',
            gap: { xs: 2.5, md: 3 },
          }}
        >
          <SectionCard title="Sobre o estabelecimento">
            <Typography variant="body1" color="textSecondary" sx={{ whiteSpace: 'pre-line' }}>
              {establishment.descricao || 'Nenhuma descrição fornecida.'}
            </Typography>
          </SectionCard>

          {/* Comodidades */}
          {establishment.comodidades && establishment.comodidades.length > 0 && (
            <SectionCard title="Comodidades">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: 2,
                }}
              >
                {establishment.comodidades.map((item: any) => (
                  <Box
                    key={item.comodidade.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        flexShrink: 0,
                        '& svg': { fontSize: 20 },
                      }}
                    >
                      {AMENITY_ICONS[item.comodidade.nome] || <Wifi />}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                      {item.comodidade.nome}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>
          )}

          {/* Acomodações */}
          {establishment.quartos && establishment.quartos.length > 0 && (
            <SectionCard
              title="Acomodações"
              subtitle="Selecione uma opção aqui ou direto no card de reserva."
            >
              <Box sx={{ display: 'grid', gap: 2 }}>
                {establishment.quartos.map((room: any) => {
                  const roomPhotos = room.fotos?.length > 0
                    ? [...room.fotos].sort((a: any, b: any) => a.ordem - b.ordem)
                    : null;
                  // Se houver mais de 4 fotos, mostra 3 + célula "+N" para caber
                  // exatamente na grade; assim nenhuma sobra de fundo aparece.
                  const fotosVisiveis: any[] = roomPhotos
                    ? roomPhotos.length > 4
                      ? roomPhotos.slice(0, 3)
                      : roomPhotos.slice(0, 4)
                    : [];
                  const colunasFotos = fotosVisiveis.length + (roomPhotos && roomPhotos.length > 4 ? 1 : 0);
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <Card
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      sx={{
                        overflow: 'hidden',
                        cursor: 'pointer',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        transition: 'border-color 180ms, box-shadow 180ms',
                        '&:hover': { borderColor: isSelected ? 'primary.main' : 'primary.light' },
                      }}
                    >
                      {roomPhotos ? (
                        <Box
                          sx={{
                            display: 'grid',
                            // As fotos preenchem a largura do card (1, 2, 3 ou 4
                            // colunas) — sem faixa escura sobrando ao lado.
                            gridTemplateColumns: `repeat(${Math.max(colunasFotos, 1)}, minmax(0, 1fr))`,
                            gap: '2px',
                            bgcolor: 'action.hover',
                          }}
                        >
                          {fotosVisiveis.map((photo: any, idx: number) => (
                            <ButtonBase
                              key={photo.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRoomGallery(roomPhotos, idx);
                              }}
                              aria-label={`Ampliar foto ${idx + 1} de ${room.nome}`}
                              sx={{
                                position: 'relative',
                                width: '100%',
                                height: { xs: 88, sm: 112 },
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                component="img"
                                src={photo.url}
                                alt={`${room.nome} — foto ${idx + 1}`}
                                loading="lazy"
                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            </ButtonBase>
                          ))}
                          {roomPhotos.length > 4 && (
                            <ButtonBase
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRoomGallery(roomPhotos, 3);
                              }}
                              aria-label={`Ver todas as ${roomPhotos.length} fotos de ${room.nome}`}
                              sx={{
                                position: 'relative',
                                width: '100%',
                                height: { xs: 88, sm: 112 },
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                component="img"
                                src={roomPhotos[3].url}
                                alt=""
                                loading="lazy"
                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              <Box
                                sx={(t) => ({
                                  position: 'absolute',
                                  inset: 0,
                                  bgcolor: alpha(t.palette.common.black, 0.58),
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                })}
                              >
                                <Typography variant="subtitle2" sx={{ color: 'common.white', fontWeight: 700 }}>
                                  +{roomPhotos.length - 3}
                                </Typography>
                              </Box>
                            </ButtonBase>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ height: 112, overflow: 'hidden' }}>
                          <MediaFallback variant="establishment" label={room.nome} />
                        </Box>
                      )}

                      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {room.nome}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
                            >
                              <People aria-hidden sx={{ fontSize: 16 }} />
                              Até {room.capacidade} {room.capacidade === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                              {room.tipoAcomodacao?.nome || 'Padrão'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 800 }}>
                              {formatCurrency(room.precoBase)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                              por noite (base)
                            </Typography>
                          </Box>
                        </Box>

                        {isSelected && (
                          <Chip size="small" color="primary" label="Selecionada" sx={{ mt: 1.5 }} />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </SectionCard>
          )}

          {/* Regras e informações gerais */}
          {regras && regras.length > 0 && (
            <SectionCard title="Regras e informações gerais">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2.5,
                }}
              >
                {regras.map((secao: any) => (
                  <Box key={secao.id} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      {secao.nome}
                    </Typography>
                    <Box
                      component="ul"
                      sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.75 }}
                    >
                      {secao.topicos?.map((topico: any) => (
                        <Typography
                          key={topico.id}
                          component="li"
                          variant="body2"
                          color="textSecondary"
                        >
                          {topico.valor ? (
                            <>
                              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                {topico.label}:
                              </Box>{' '}
                              {topico.valor}
                            </>
                          ) : (
                            topico.label
                          )}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </SectionCard>
          )}

          {/* Avaliações */}
          <SectionCard
            title="Avaliações"
            subtitle={
              establishment.totalAvaliacoes > 0
                ? `${establishment.totalAvaliacoes} ${establishment.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'} · média ${Number(establishment.notaMedia).toFixed(1)}`
                : 'Ainda não há avaliações publicadas'
            }
          >
            {isLoadingReviews ? (
              <Box sx={{ display: 'grid', gap: 2.5 }}>
                {[0, 1, 2].map((i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="35%" />
                      <Skeleton variant="text" width="80%" />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : reviewsError ? (
              <ErrorState
                compact
                title="Não foi possível carregar as avaliações"
                onRetry={() => refetchReviews()}
              />
            ) : !avaliacoes || avaliacoes.length === 0 ? (
              <EmptyState
                compact
                icon={<RateReviewOutlined />}
                title="Ainda não há avaliações"
                description="As avaliações aparecem aqui depois que os hóspedes concluírem a estadia."
              />
            ) : (
              <Box sx={{ display: 'grid', gap: 3 }}>
                {avaliacoes.slice(0, 5).map((av: any) => (
                  <Box key={av.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Avatar sx={{ width: 40, height: 40, fontSize: '0.9375rem', flexShrink: 0 }}>
                      {av.reserva?.hospede?.nome?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {av.reserva?.hospede?.nome || 'Hóspede'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatDate(av.criadoEm)}
                        </Typography>
                      </Box>
                      <Rating
                        value={Number(av.nota) || 0}
                        readOnly
                        size="small"
                        getLabelText={(value) => `${value} de 5 estrelas`}
                        aria-label={`Nota ${av.nota} de 5`}
                        sx={{ mt: 0.5 }}
                      />
                      {av.comentario && (
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          sx={{ mt: 1, whiteSpace: 'pre-line' }}
                        >
                          {av.comentario}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
                {avaliacoes.length > 5 && (
                  <Typography variant="caption" color="textSecondary">
                    Exibindo as 5 avaliações mais recentes de {avaliacoes.length}.
                  </Typography>
                )}
              </Box>
            )}
          </SectionCard>

          {/* Localização */}
          <SectionCard title="Localização">
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
              <LocationOn
                aria-hidden
                sx={{ color: 'primary.main', fontSize: 22, mt: 0.25, flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {establishment.endereco || 'Endereço não informado'}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 0.25 }}>
                  CEP {establishment.cep || '00000-000'} · {cidadeUF || 'Cidade não informada'}
                </Typography>
              </Box>
            </Box>

            {establishment.latitude && establishment.longitude ? (
              <Box
                sx={{
                  height: { xs: 240, sm: 300, md: 340 },
                  borderRadius: `${radius.lg}px`,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <MapContainer
                  center={[Number(establishment.latitude), Number(establishment.longitude)]}
                  zoom={15}
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[Number(establishment.latitude), Number(establishment.longitude)]}>
                    <Popup>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{establishment.nome}</Typography>
                    </Popup>
                  </Marker>
                  <MapController center={[Number(establishment.latitude), Number(establishment.longitude)]} />
                </MapContainer>
              </Box>
            ) : (
              <Alert severity="warning">
                Coordenadas do mapa não cadastradas para este estabelecimento.
              </Alert>
            )}
          </SectionCard>
        </Box>

        {/* ================= CARD DE RESERVA ================= */}
        <Box sx={{ gridArea: 'reserva', minWidth: 0 }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            <SectionCard
              title="Reserve sua estadia"
              subtitle={
                selectedRoom
                  ? `Diária base ${formatCurrency(selectedRoom.precoBase)}`
                  : 'Escolha a acomodação e as datas'
              }
            >
              <Box component="form" onSubmit={handleBookingSubmit} sx={{ display: 'grid', gap: 2.25 }}>
                    {/* Room Selection */}
                    <FormControl fullWidth>
                      <InputLabel id="select-quarto-label">Acomodação</InputLabel>
                      <Select
                        labelId="select-quarto-label"
                        id="select-quarto"
                        value={selectedRoomId}
                        label="Acomodação"
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        required
                      >
                        {establishment.quartos?.map((room: any) => (
                          <MenuItem key={room.id} value={room.id}>
                            {room.nome} (Máx: {room.capacidade} p.)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Date Checkin */}
                    <TextField
                      label="Check-in"
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      slotProps={{
                        htmlInput: {
                          min: todayStr,
                        },
                        inputLabel: {
                          shrink: true,
                        },
                      }}
                      fullWidth
                      required
                    />

                    {/* Date Checkout */}
                    <TextField
                      label="Check-out"
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      slotProps={{
                        htmlInput: {
                          min: checkIn || tomorrowStr,
                        },
                        inputLabel: {
                          shrink: true,
                        },
                      }}
                      fullWidth
                      required
                    />

                    {/* Guest selection */}
                    <FormGrid columns={2}>
                      <TextField
                        label="Adultos"
                        type="number"
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                        onBlur={() => setAdults(Math.max(1, Number(adults) || 1))}
                        slotProps={{
                          htmlInput: {
                            min: 1,
                          },
                        }}
                        fullWidth
                      />
                      <TextField
                        label="Crianças"
                        type="number"
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                        onBlur={() => setChildren(Math.max(0, Number(children) || 0))}
                        slotProps={{
                          htmlInput: {
                            min: 0,
                          },
                        }}
                        fullWidth
                      />
                    </FormGrid>

                    {/* Payment choice */}
                    <FormControl fullWidth>
                      <InputLabel id="select-pagamento-label">Método de Pagamento</InputLabel>
                      <Select
                        labelId="select-pagamento-label"
                        id="select-pagamento"
                        value={paymentMethod}
                        label="Método de Pagamento"
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        required
                      >
                        <MenuItem value="PIX">Pix (Simulado)</MenuItem>
                        <MenuItem value="BOLETO">Boleto Bancário (Simulado)</MenuItem>
                        <MenuItem value="CARTAO">Cartão de Crédito (Simulado)</MenuItem>
                      </Select>
                    </FormControl>

                    {/* Resumo de valores */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: 'action.hover',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {isLoadingPrice || isLoadingAvailability ? (
                        <Skeleton height={64} />
                      ) : isDatesValid && selectedRoomId ? (
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <InfoRow
                            label={`Diárias (${nights} ${nights === 1 ? 'noite' : 'noites'})`}
                            value={formatCurrency(priceData)}
                          />
                          <Divider />
                          <InfoRow label="Valor total" value={formatCurrency(priceData)} emphasis />
                          {availabilityData &&
                            (availabilityData.disponivel ? (
                              <Alert severity="success" sx={{ mt: 0.5 }}>
                                Disponível para reserva!
                              </Alert>
                            ) : (
                              <Alert severity="error" sx={{ mt: 0.5 }}>
                                Quarto indisponível neste período.
                              </Alert>
                            ))}
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          sx={{ textAlign: 'center', py: 1 }}
                        >
                          Selecione o quarto e o período para simular valores e verificar disponibilidade.
                        </Typography>
                      )}
                    </Box>

                {/* Botão de reserva */}
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={isSubmitting || (isDatesValid && availabilityData && !availabilityData.disponivel)}
                  fullWidth
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? 'Solicitando...' : 'Solicitar reserva'}
                </Button>
              </Box>

              {/* Contato do proprietário */}
              <Box sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography
                  variant="overline"
                  component="p"
                  color="textSecondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Contato do proprietário
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    <People
                      aria-hidden
                      sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25, flexShrink: 0 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>
                      {establishment.proprietario?.nome}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    <Email
                      aria-hidden
                      sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25, flexShrink: 0 }}
                    />
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                      {establishment.emailContato || establishment.proprietario?.email}
                    </Typography>
                  </Box>
                  {establishment.contato && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                      <Phone
                        aria-hidden
                        sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25, flexShrink: 0 }}
                      />
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                        {establishment.contato}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </SectionCard>
          </Box>
        </Box>
      </Box>

      {/* ================= GALERIA DE FOTOS (LIGHTBOX) ================= */}
      <Dialog
        open={roomGalleryOpen}
        onClose={() => setRoomGalleryOpen(false)}
        maxWidth="lg"
        fullWidth
        aria-label="Galeria de fotos"
        slotProps={{
          paper: {
            sx: { borderRadius: `${radius.lg}px`, bgcolor: 'common.black', overflow: 'hidden' },
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            minHeight: { xs: 280, sm: 400 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 1, sm: 2 },
          }}
        >
          <IconButton
            onClick={() => setRoomGalleryOpen(false)}
            aria-label="Fechar galeria"
            sx={(t) => ({
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              color: t.palette.common.white,
              bgcolor: alpha(t.palette.common.black, 0.5),
              '&:hover': { bgcolor: alpha(t.palette.common.black, 0.72) },
            })}
          >
            <Close />
          </IconButton>

          {roomGalleryPhotos.length > 1 && (
            <IconButton
              onClick={() => setRoomGalleryIndex((prev) => (prev === 0 ? roomGalleryPhotos.length - 1 : prev - 1))}
              aria-label="Foto anterior"
              sx={(t) => ({
                position: 'absolute',
                left: 8,
                zIndex: 10,
                color: t.palette.common.white,
                bgcolor: alpha(t.palette.common.black, 0.5),
                '&:hover': { bgcolor: alpha(t.palette.common.black, 0.72) },
              })}
            >
              <ChevronLeft />
            </IconButton>
          )}

          <Box
            component="img"
            src={roomGalleryPhotos[roomGalleryIndex]?.url}
            alt={`Foto ampliada ${roomGalleryIndex + 1} de ${roomGalleryPhotos.length}`}
            sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
          />

          {roomGalleryPhotos.length > 1 && (
            <IconButton
              onClick={() => setRoomGalleryIndex((prev) => (prev === roomGalleryPhotos.length - 1 ? 0 : prev + 1))}
              aria-label="Próxima foto"
              sx={(t) => ({
                position: 'absolute',
                right: 8,
                zIndex: 10,
                color: t.palette.common.white,
                bgcolor: alpha(t.palette.common.black, 0.5),
                '&:hover': { bgcolor: alpha(t.palette.common.black, 0.72) },
              })}
            >
              <ChevronRight />
            </IconButton>
          )}

          {roomGalleryPhotos.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 1,
              }}
            >
              {roomGalleryPhotos.map((_: any, idx: number) => (
                <ButtonBase
                  key={idx}
                  onClick={() => setRoomGalleryIndex(idx)}
                  aria-label={`Ir para foto ${idx + 1}`}
                  sx={(t) => ({
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor:
                      idx === roomGalleryIndex
                        ? t.palette.common.white
                        : alpha(t.palette.common.white, 0.4),
                    transition: 'background-color 120ms',
                  })}
                />
              ))}
            </Box>
          )}
        </Box>
      </Dialog>

      {/* ================= DIÁLOGO DE SUCESSO DA RESERVA ================= */}
      <Dialog
        open={successDialogOpen}
        maxWidth="sm"
        fullWidth
        onClose={(_e, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setSuccessDialogOpen(false);
          }
        }}
        aria-labelledby="reserva-sucesso-titulo"
        slotProps={{
          paper: {
            sx: { borderRadius: `${radius.xxl}px` },
          },
        }}
      >
        <DialogTitle id="reserva-sucesso-titulo" sx={{ textAlign: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <Box
              aria-hidden
              sx={(t) => ({
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: alpha(t.palette.success.main, 0.12),
                color: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <CheckCircle sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h5" component="span" sx={{ fontWeight: 700 }}>
              Solicitação efetuada!
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2.5, mt: 0.5 }}>
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
              Sua reserva no <strong>{establishment.nome}</strong> foi solicitada. O proprietário analisará seu pedido e você receberá atualizações em sua conta.
            </Typography>

            <Divider />

            <InfoGrid columns={2}>
              <InfoItem
                label="Código da reserva"
                value={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: 'primary.main',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {createdReservation?.codigoReserva}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyText(createdReservation?.codigoReserva, 'Código de reserva')}
                      aria-label="Copiar código da reserva"
                    >
                      <ContentCopy sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                }
              />
              <InfoItem
                label="Valor total"
                emphasis
                value={formatCurrency(createdReservation?.valorTotal)}
              />
            </InfoGrid>

            <Alert severity="info">
              Status atual: <strong>AGUARDANDO APROVAÇÃO</strong>.
            </Alert>

            {/* Simulated Payment details depending on selected method */}
            {!isMpEstabelecimento && paymentMethod === 'PIX' && pixData && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceWallet aria-hidden sx={{ color: 'primary.main' }} /> Pagamento PIX (Simulado)
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Copie a chave Pix abaixo e pague no app do seu banco. A aprovação da reserva ocorrerá após o proprietário conferir o comprovante.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box
                    sx={{
                      bgcolor: 'common.white',
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <img src={pixData.qrCode} alt="QR Code do Pix" style={{ width: 110, height: 110 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                      PIX COPIA E COLA
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        size="small"
                        value={pixData.pixCopyPaste}
                        slotProps={{
                          input: {
                            readOnly: true,
                            sx: { fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'action.hover' },
                          },
                        }}
                        fullWidth
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleCopyText(pixData.pixCopyPaste, 'Pix Copia e Cola')}
                        sx={{ py: 1 }}
                      >
                        Copiar
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            {!isMpEstabelecimento && paymentMethod === 'BOLETO' && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Receipt aria-hidden sx={{ color: 'warning.main' }} /> Boleto Bancário (Simulado)
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Copie a linha digitável do boleto para realizar o pagamento simulado:
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    value={`34191.79001 01043.513184 91020.150008 7 982500000${Math.floor(Number(createdReservation?.valorTotal || 0))}`}
                    slotProps={{
                      input: {
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'action.hover' },
                      },
                    }}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    size="small"
                    color="warning"
                    onClick={() => handleCopyText(`34191.79001 01043.513184 91020.150008 7 982500000${Math.floor(Number(createdReservation?.valorTotal || 0))}`, 'Código de barras')}
                    sx={{ py: 1 }}
                  >
                    Copiar
                  </Button>
                </Box>
              </Box>
            )}

            {!isMpEstabelecimento && paymentMethod === 'CARTAO' && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CreditCard aria-hidden sx={{ color: 'text.secondary' }} /> Simulação de Cartão de Crédito
                </Typography>

                {cardSimulated ? (
                  <Alert severity="success">
                    Pagamento via cartão autorizado com sucesso!
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      label="Número do Cartão"
                      size="small"
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').substring(0, 16))}
                      fullWidth
                    />
                    <TextField
                      label="Nome do Titular"
                      size="small"
                      placeholder="JOÃO DA SILVA"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      fullWidth
                    />
                    <FormGrid columns={2}>
                      <TextField
                        label="Validade (MM/AA)"
                        size="small"
                        placeholder="12/29"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value.substring(0, 5))}
                        fullWidth
                      />
                      <TextField
                        label="CVV"
                        size="small"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                        fullWidth
                      />
                    </FormGrid>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={handleSimulateCreditCard}
                    >
                      Simular autorização de cartão
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {isMpEstabelecimento && !mpCheckout && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceWallet aria-hidden sx={{ color: 'primary.main' }} /> Pagamento via Mercado Pago
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Sua solicitação foi enviada. Assim que o estabelecimento confirmar a reserva, o pagamento
                  (PIX, boleto ou cartão) ficará disponível em <strong>Minhas Reservas</strong>, no ambiente do
                  Mercado Pago. O reconhecimento é automático — não é necessário enviar comprovante.
                </Typography>
              </Box>
            )}

            {isMpEstabelecimento && mpCheckout && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceWallet aria-hidden sx={{ color: 'primary.main' }} /> Pagamento via Mercado Pago
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  O pagamento é confirmado automaticamente pela plataforma assim que compensado — não é necessário enviar comprovante.
                </Typography>

                {paymentMethod === 'PIX' && (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box
                      sx={{
                        bgcolor: 'common.white',
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                      }}
                    >
                      <img
                        src={mpCheckout.checkout.qrCodeBase64?.startsWith('data:') ? mpCheckout.checkout.qrCodeBase64 : `data:image/png;base64,${mpCheckout.checkout.qrCodeBase64}`}
                        alt="QR Code do Pix"
                        style={{ width: 140, height: 140 }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        PIX COPIA E COLA
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          size="small"
                          value={mpCheckout.checkout.pixCopyPaste}
                          slotProps={{
                            input: {
                              readOnly: true,
                              sx: { fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'action.hover' },
                            },
                          }}
                          fullWidth
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleCopyText(mpCheckout.checkout.pixCopyPaste, 'Pix Copia e Cola')}
                          sx={{ py: 1 }}
                        >
                          Copiar
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {paymentMethod === 'BOLETO' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <TextField
                      size="small"
                      value={mpCheckout.checkout.boletoBarcode}
                      slotProps={{
                        input: {
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'action.hover' },
                        },
                      }}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      size="small"
                      color="warning"
                      onClick={() => handleCopyText(mpCheckout.checkout.boletoBarcode, 'Código de barras')}
                      sx={{ py: 1 }}
                    >
                      Copiar
                    </Button>
                    {mpCheckout.checkout.boletoUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="warning"
                        onClick={() => window.open(mpCheckout.checkout.boletoUrl, '_blank', 'noopener,noreferrer')}
                        sx={{ py: 1 }}
                      >
                        Abrir Boleto no Banco
                      </Button>
                    )}
                  </Box>
                )}

                {paymentMethod === 'CARTAO' && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Clique no botão abaixo para concluir o pagamento com cartão com segurança no ambiente do Mercado Pago.
                  </Alert>
                )}
              </Box>
            )}

            {isMpEstabelecimento && paymentMethod === 'CARTAO' && mpCheckout?.checkout?.initPoint && (
              <Button
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                onClick={handleOpenMpCheckout}
              >
                Pagar com cartão via Mercado Pago
              </Button>
            )}

            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={() => navigate('/hospede/reservas')}
            >
              Ir para minhas reservas
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
