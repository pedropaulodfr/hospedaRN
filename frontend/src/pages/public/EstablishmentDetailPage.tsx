import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Container, Grid, Typography, Button, TextField,
  Card, CardContent, CardMedia, Rating, Chip,
  Skeleton, IconButton, Paper, Divider, useTheme, useMediaQuery,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, Alert,
  ImageList, ImageListItem,
} from '@mui/material';
import {
  Wifi, Pool, LocalParking, FreeBreakfast, Tv, AcUnit, Kitchen, Pets,
  FitnessCenter, LocalBar, Restaurant, RoomService, Star, LocationOn,
  Phone, Language, ArrowBack, CalendarToday, People, AccountBalanceWallet,
  ContentCopy, CheckCircle, CreditCard, Receipt, Email, Close
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { establishmentsApi, roomsApi, reservationsApi, paymentsApi, regrasApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();

  // Booking states
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card details states (for CC simulation)
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardSimulated, setCardSimulated] = useState(false);

  // Query details
  const { data: establishment, isLoading, error } = useQuery({
    queryKey: ['establishmentDetail', id],
    queryFn: () => establishmentsApi.getOne(id!).then(res => res.data.data),
    enabled: !!id,
  });

  // Query regras
  const { data: regras } = useQuery({
    queryKey: ['establishmentRegras', id],
    queryFn: () => regrasApi.getByEstablishment(id!).then(res => res.data),
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

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Skeleton variant="text" width="60%" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="40%" height={30} sx={{ mb: 4 }} />
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 4, mb: 4 }} />
            <Skeleton variant="text" height={100} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 4 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !establishment) {
    return (
      <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
        <Alert severity="error" sx={{ borderRadius: 3, mb: 4 }}>
          Não foi possível carregar os detalhes do estabelecimento.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/busca')}>
          Voltar para a Busca
        </Button>
      </Container>
    );
  }

  // Gallery Photos
  const photos = establishment.fotos && establishment.fotos.length > 0
    ? [...establishment.fotos].sort((a: any, b: any) => a.ordem - b.ordem)
    : [{ url: establishment.fotoPerfil || 'https://placehold.co/800x450/0097A7/FFFFFF?text=HospedaRN' }];

  const activePhotoUrl = photos[activePhotoIndex]?.url || 'https://placehold.co/800x450/0097A7/FFFFFF?text=HospedaRN';

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
    if (selectedRoom && (adults + children) > selectedRoom.capacidade) {
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
        adultos: adults,
        criancas: children,
        observacoes: 'Reserva efetuada pelo painel de detalhes.',
      });

      const reserva = resReserva.data.data;
      setCreatedReservation(reserva);

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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pt: { xs: 8, md: 10 } }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Back navigation */}
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            sx={{ fontWeight: 600, color: 'text.secondary' }}
          >
            Voltar
          </Button>
        </Box>

        {/* ================= HEADER ================= */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontFamily: '"Outfit", sans-serif',
              mb: 1,
              background: 'linear-gradient(135deg, #1A2332, #0097A7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {establishment.nome}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Star sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {Number(establishment.notaMedia).toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({establishment.totalAvaliacoes} {establishment.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})
              </Typography>
            </Box>
            <Chip
              icon={<LocationOn />}
              label={`${establishment.cidade?.nome}, ${establishment.cidade?.estado}`}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </Box>

        {/* ================= CONTENT LAYOUT ================= */}
        <Grid container spacing={4}>
          {/* LEFT COLUMN: Photos, Details, amenities, rules, map */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Gallery */}
            <Card sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', mb: 4 }}>
              <CardMedia
                component="img"
                image={activePhotoUrl}
                alt={establishment.nome}
                sx={{
                  height: { xs: 260, sm: 450 },
                  width: '100%',
                  objectFit: 'cover',
                  transition: 'all 0.5s ease',
                }}
              />
              {photos.length > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    p: 2,
                    bgcolor: 'background.paper',
                    overflowX: 'auto',
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  {photos.map((photo: any, index: number) => (
                    <Box
                      key={photo.id || index}
                      onClick={() => setActivePhotoIndex(index)}
                      sx={{
                        width: 80,
                        height: 60,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: activePhotoIndex === index ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        opacity: activePhotoIndex === index ? 1 : 0.7,
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={`Thumbnail ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Card>

            {/* Description */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(0,0,0,0.05)', mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', mb: 2 }}>
                Sobre o estabelecimento
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {establishment.descricao || 'Nenhuma descrição fornecida.'}
              </Typography>
            </Paper>

            {/* Amenities */}
            {establishment.comodidades && establishment.comodidades.length > 0 && (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(0,0,0,0.05)', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', mb: 2 }}>
                  Comodidades e Vantagens
                </Typography>
                <Grid container spacing={2}>
                  {establishment.comodidades.map((item: any) => (
                    <Grid key={item.comodidade.id} size={{ xs: 6, sm: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.primary' }}>
                        <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                          {AMENITY_ICONS[item.comodidade.nome] || <Wifi />}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.comodidade.nome}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

            {/* Rooms list */}
            {establishment.quartos && establishment.quartos.length > 0 && (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(0,0,0,0.05)', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', mb: 3 }}>
                  Opções de Acomodação
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {establishment.quartos.map((room: any) => {
                    const roomPhotos = room.fotos?.length > 0
                      ? [...room.fotos].sort((a: any, b: any) => a.ordem - b.ordem)
                      : null;
                    return (
                      <Card
                        key={room.id}
                        sx={{
                          borderRadius: 3,
                          overflow: 'hidden',
                          border: '1px solid rgba(0,0,0,0.06)',
                          boxShadow: 'none',
                        }}
                      >
                        {roomPhotos ? (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: roomPhotos.length >= 2 ? '1fr 1fr' : '1fr',
                              gridTemplateRows: roomPhotos.length >= 3 ? '200px 100px' : '200px',
                              gap: '2px',
                              bgcolor: '#000',
                            }}
                          >
                            {roomPhotos.slice(0, 4).map((photo: any, idx: number) => (
                              <Box
                                key={photo.id}
                                onClick={() => handleOpenRoomGallery(roomPhotos, idx)}
                                sx={{
                                  position: 'relative',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  height: idx === 0 && roomPhotos.length >= 3 ? '100%' : undefined,
                                  gridRow: idx === 0 && roomPhotos.length >= 3 ? '1 / 3' : undefined,
                                  '&:hover .overlay': { opacity: 1 },
                                }}
                              >
                                <Box
                                  component="img"
                                  src={photo.url}
                                  alt={room.nome}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                                <Box
                                  className="overlay"
                                  sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                </Box>
                              </Box>
                            ))}
                            {roomPhotos.length > 4 && (
                              <Box
                                onClick={() => handleOpenRoomGallery(roomPhotos, 4)}
                                sx={{
                                  position: 'relative',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  height: 100,
                                  '&:hover .overlay': { opacity: 1 },
                                }}
                              >
                                <Box
                                  component="img"
                                  src={roomPhotos[4].url}
                                  alt={room.nome}
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                                <Box
                                  className="overlay"
                                  sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                                    +{roomPhotos.length - 4}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: 130,
                              bgcolor: 'rgba(0,151,167,0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Sem foto
                            </Typography>
                          </Box>
                        )}
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {room.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Tipo: {room.tipoAcomodacao?.nome || 'Padrão'}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                              <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                                R$ {Number(room.precoBase).toFixed(2)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                por noite (base)
                              </Typography>
                            </Box>
                          </Box>
                          <Divider sx={{ my: 1.5 }} />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                              <People sx={{ fontSize: 18 }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                Capacidade: {room.capacidade} {room.capacidade === 1 ? 'pessoa' : 'pessoas'}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Paper>
            )}

            {/* Rules and Timings */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(0,0,0,0.05)', mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', mb: 3 }}>
                Regras e Informações Gerais
              </Typography>
              <Grid container spacing={3}>
                {regras?.map((secao: any) => (
                  <Grid key={secao.id} size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      {secao.nome}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {secao.topicos?.map((topico: any) => (
                        <Typography key={topico.id} variant="body2" color="text.secondary">
                          {topico.valor ? <><strong>{topico.label}:</strong> {topico.valor}</> : `• ${topico.label}`}
                        </Typography>
                      ))}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* Location & Map */}
            <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid rgba(0,0,0,0.05)' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', mb: 2 }}>
                Localização
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
                <LocationOn sx={{ color: 'primary.main', mt: 0.3 }} />
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {establishment.endereco || 'Endereço não informado'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CEP {establishment.cep || '00000-000'} | {establishment.cidade?.nome} - {establishment.cidade?.estado}
                  </Typography>
                </Box>
              </Box>

              {establishment.latitude && establishment.longitude ? (
                <Box sx={{ height: 300, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
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
                <Alert severity="warning" sx={{ borderRadius: 3 }}>
                  Coordenadas do mapa não cadastradas para este estabelecimento.
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* ================= RIGHT COLUMN: STICKY BOOKING FORM ================= */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ position: 'sticky', top: 96 }}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.4)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif', mb: 3 }}>
                  Reserve sua Estadia
                </Typography>

                <form onSubmit={handleBookingSubmit}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Adultos"
                          type="number"
                          value={adults}
                          onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                          slotProps={{
                            htmlInput: {
                              min: 1,
                            },
                          }}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Crianças"
                          type="number"
                          value={children}
                          onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                          slotProps={{
                            htmlInput: {
                              min: 0,
                            },
                          }}
                          fullWidth
                        />
                      </Grid>
                    </Grid>

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

                    {/* Pricing Summary */}
                    <Box sx={{ mt: 1, p: 2, borderRadius: 3, bgcolor: 'rgba(0, 151, 167, 0.04)', border: '1px solid rgba(0, 151, 167, 0.08)' }}>
                      {isLoadingPrice || isLoadingAvailability ? (
                        <Skeleton height={60} />
                      ) : isDatesValid && selectedRoomId ? (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Diárias ({nights} {nights === 1 ? 'noite' : 'noites'}):
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              R$ {priceData ? priceData.toFixed(2) : '0.00'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              Valor Total:
                            </Typography>
                            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                              R$ {priceData ? priceData.toFixed(2) : '0.00'}
                            </Typography>
                          </Box>
                          {availabilityData && (
                            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {availabilityData.disponivel ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                                  <CheckCircle fontSize="small" />
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Disponível para reserva!
                                  </Typography>
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                                  <Star fontSize="small" /> {/* Fallback icon */}
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Quarto indisponível neste período.
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                          Selecione o quarto e o período para simular valores e verificar disponibilidade.
                        </Typography>
                      )}
                    </Box>

                    {/* Book submit button */}
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      size="large"
                      disabled={isSubmitting || (isDatesValid && availabilityData && !availabilityData.disponivel)}
                      fullWidth
                      sx={{
                        py: 1.5,
                        borderRadius: 3,
                        fontWeight: 700,
                        fontSize: '1rem',
                        boxShadow: 'none',
                        '&:hover': {
                          boxShadow: '0 4px 14px rgba(0,151,167,0.3)',
                        },
                      }}
                    >
                      {isSubmitting ? 'Solicitando...' : 'Solicitar Reserva'}
                    </Button>
                  </Box>
                </form>

                {/* Owner info */}
                <Box sx={{ mt: 3, p: 2, borderRadius: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.100' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
                    Contato do Proprietário
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <People sx={{ fontSize: 16, color: 'text.secondary' }} /> {establishment.proprietario?.nome}
                  </Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Email sx={{ fontSize: 16, color: 'text.secondary' }} /> {establishment.emailContato || establishment.proprietario?.email}
                  </Typography>
                  {establishment.contato && (
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone sx={{ fontSize: 16, color: 'text.secondary' }} /> {establishment.contato}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* ================= ROOM PHOTO LIGHTBOX ================= */}
      <Dialog
        open={roomGalleryOpen}
        onClose={() => setRoomGalleryOpen(false)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 4, bgcolor: '#000', overflow: 'hidden' },
          },
        }}
      >
        <Box sx={{ position: 'relative', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconButton
            onClick={() => setRoomGalleryOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 10, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <Close />
          </IconButton>

          {roomGalleryPhotos.length > 1 && (
            <IconButton
              onClick={() => setRoomGalleryIndex((prev) => (prev === 0 ? roomGalleryPhotos.length - 1 : prev - 1))}
              sx={{ position: 'absolute', left: 8, color: '#fff', zIndex: 10, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
            >
              <ArrowBack />
            </IconButton>
          )}

          <Box
            component="img"
            src={roomGalleryPhotos[roomGalleryIndex]?.url}
            alt="Foto do quarto"
            sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
          />

          {roomGalleryPhotos.length > 1 && (
            <IconButton
              onClick={() => setRoomGalleryIndex((prev) => (prev === roomGalleryPhotos.length - 1 ? 0 : prev + 1))}
              sx={{ position: 'absolute', right: 8, color: '#fff', zIndex: 10, bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
            >
              <ArrowBack sx={{ transform: 'rotate(180deg)' }} />
            </IconButton>
          )}

          {roomGalleryPhotos.length > 1 && (
            <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
              {roomGalleryPhotos.map((_: any, idx: number) => (
                <Box
                  key={idx}
                  onClick={() => setRoomGalleryIndex(idx)}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: idx === roomGalleryIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Dialog>

      {/* ================= SUCCESS CHECKOUT DIALOG ================= */}
      <Dialog
        open={successDialogOpen}
        maxWidth="sm"
        fullWidth
        onClose={(_e, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setSuccessDialogOpen(false);
          }
        }}
        slotProps={{
          paper: {
            sx: { borderRadius: 4, p: 2 },
          },
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'success.light',
                color: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(76,175,80,0.2)',
              }}
            >
              <CheckCircle sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
              Solicitação Efetuada!
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Sua reserva no <strong>{establishment.nome}</strong> foi solicitada. O proprietário analisará seu pedido e você receberá atualizações em sua conta.
            </Typography>

            <Divider />

            {/* Info details */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  CÓDIGO DA RESERVA
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.05rem', color: 'primary.main' }}>
                    {createdReservation?.codigoReserva}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleCopyText(createdReservation?.codigoReserva, 'Código de reserva')}
                  >
                    <ContentCopy sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  VALOR DA DIÁRIA
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  R$ {createdReservation?.valorTotal ? Number(createdReservation.valorTotal).toFixed(2) : '0.00'}
                </Typography>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ borderRadius: 3 }}>
              Status Atual: <strong>AGUARDANDO APROVAÇÃO</strong>.
            </Alert>

            {/* Simulated Payment details depending on selected method */}
            {paymentMethod === 'PIX' && pixData && (
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'primary.light', bgcolor: 'rgba(0,151,167,0.02)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceWallet sx={{ color: 'primary.main' }} /> Pagamento PIX (Simulado)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Copie a chave Pix abaixo e pague no app do seu banco. A aprovação da reserva ocorrerá após o proprietário conferir o comprovante.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box sx={{ bgcolor: 'white', p: 1, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2 }}>
                    <img src={pixData.qrCode} alt="PIX QR Code" style={{ width: 110, height: 110 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      PIX COPIA E COLA
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        size="small"
                        value={pixData.pixCopyPaste}
                        slotProps={{
                          input: {
                            readOnly: true,
                            sx: { fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'grey.50' },
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

            {paymentMethod === 'BOLETO' && (
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'warning.light', bgcolor: 'rgba(255,112,67,0.02)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Receipt sx={{ color: 'warning.main' }} /> Boleto Bancário (Simulado)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Copie a linha digitável do boleto para realizar o pagamento simulado:
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    value={`34191.79001 01043.513184 91020.150008 7 982500000${Math.floor(Number(createdReservation?.valorTotal || 0))}`}
                    slotProps={{
                      input: {
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'grey.50' },
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

            {paymentMethod === 'CARTAO' && (
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'grey.300', bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CreditCard sx={{ color: 'text.secondary' }} /> Simulação de Cartão de Crédito
                </Typography>

                {cardSimulated ? (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
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
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Validade (MM/AA)"
                          size="small"
                          placeholder="12/29"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value.substring(0, 5))}
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="CVV"
                          size="small"
                          placeholder="123"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={handleSimulateCreditCard}
                      sx={{ mt: 1, fontWeight: 700 }}
                    >
                      Simular Autorização de Cartão
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={() => navigate('/hospede/reservas')}
              sx={{ py: 1.5, borderRadius: 3, fontWeight: 700, mt: 1 }}
            >
              Ir para Minhas Reservas
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
