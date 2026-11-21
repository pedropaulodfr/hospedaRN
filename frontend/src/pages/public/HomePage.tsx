import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  TextField,
  InputAdornment,
  Chip,
  Rating,
  Skeleton,
  Autocomplete,
  alpha,
} from '@mui/material';
import {
  Search,
  Place,
  ArrowForward,
  Home,
  Event as EventIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { citiesApi, establishmentsApi, eventsApi } from '../../services/api';
import { useUIStore } from '../../stores/uiStore';
import { MediaFallback, PageContainer, SectionHeading } from '../../components/common';
import { FavoriteButton } from '../../components/favorites/FavoriteButton';
import {
  EventDetailsDialog,
  eventCover,
  eventDateParts,
  type EventData,
} from '../../components/events/EventDetailsDialog';
import { formatCurrency } from '../../theme/tokens';

/**
 * Fotos do carrossel do hero.
 *
 * A terceira imagem é o cartão-postal real do RN: dunas e lagoa de Genipabu
 * (Extremoz/RN), foto em domínio público (CC0) do Wikimedia Commons — sem
 * obrigação de atribuição e sem marca d'água. As duas primeiras são praias
 * usadas só como atmosfera.
 */
const heroImages = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Dunas_de_Genipabu_-_RN.jpg/1920px-Dunas_de_Genipabu_-_RN.jpg',
];

/** Menor diária entre os quartos ativos do estabelecimento (dado real da API). */
function minRoomPrice(est: any): number | null {
  const precos = (est?.quartos ?? [])
    .map((quarto: any) => Number(quarto.precoBase))
    .filter((valor: number) => Number.isFinite(valor) && valor > 0);
  return precos.length > 0 ? Math.min(...precos) : null;
}

/** Data do evento em blocos curtos (dia + mês) para o card da agenda. */
export default function HomePage() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Evento aberto no dialog de detalhes (mesmo componente usado em /eventos).
  const [detailEvent, setDetailEvent] = useState<EventData | null>(null);
  const navigate = useNavigate();
  const { setSearchFilters } = useUIStore();

  // Rotaciona as imagens do hero.
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: () => citiesApi.getAll(true),
    select: (res) => res.data.data,
  });

  const { data: establishmentsPayload, isLoading: loadingEst } = useQuery({
    queryKey: ['establishments-featured'],
    queryFn: () => establishmentsApi.getAll({ limit: 6 }),
    select: (res) => res.data.data,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events-upcoming'],
    queryFn: () => eventsApi.getAll(true),
    select: (res) => res.data.data,
  });

  const establishmentsData = establishmentsPayload?.data;

  const handleSearch = () => {
    if (searchQuery) {
      const trimmedQuery = searchQuery.trim();
      const matchedCity = citiesData?.find(
        (c: any) => c.nome.trim().toLowerCase() === trimmedQuery.toLowerCase()
      );

      if (matchedCity) {
        setSearchFilters({ cityId: matchedCity.id, search: '' });
        navigate(`/busca?cityId=${matchedCity.id}`);
      } else {
        setSearchFilters({ search: trimmedQuery, cityId: '' });
        navigate(`/busca?search=${encodeURIComponent(trimmedQuery)}`);
      }
    } else {
      navigate('/busca');
    }
  };

  return (
    <Box>
      {/* ===== HERO ===== */}
      <Box
        component="section"
        aria-label="Destaque da página inicial"
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          minHeight: { xs: 'auto', md: 'clamp(580px, 78vh, 720px)' },
          py: { xs: 7, md: 8 },
        }}
      >
        {heroImages.map((img, index) => (
          <Box
            key={img}
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transition: 'opacity 1.2s ease',
              opacity: heroIndex === index ? 1 : 0,
            }}
          />
        ))}

        {/* Overlay: mais escuro à esquerda, onde fica o texto, e mais leve à
            direita para a paisagem aparecer — garante contraste sobre areia clara. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(100deg, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.46) 42%, rgba(0,0,0,0.24) 100%)',
          }}
        />

        <PageContainer
          maxWidth="content"
          gutterTop={false}
          sx={{ position: 'relative', zIndex: 2, pt: 0, pb: 0 }}
        >
          <Box sx={{ maxWidth: 880 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                mb: 2,
                borderRadius: 999,
                bgcolor: (t) => alpha(t.palette.common.white, 0.12),
                border: (t) => `1px solid ${alpha(t.palette.common.white, 0.22)}`,
                backdropFilter: 'blur(6px)',
              }}
            >
              <Box
                aria-hidden
                sx={(t) => ({
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: t.palette.secondary.light,
                })}
              />
              <Typography
                variant="caption"
                component="p"
                sx={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Descubra o Rio Grande do Norte
              </Typography>
            </Box>

            <Typography
              variant="h1"
              sx={{
                color: 'common.white',
                fontSize: { xs: '2.125rem', md: '2.875rem', lg: '3.25rem' },
                mb: 2.5,
                textShadow: '0 2px 24px rgba(0,0,0,0.35)',
              }}
            >
              Sua próxima aventura no Rio Grande do Norte começa aqui
            </Typography>

            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.86)',
                mb: 4,
                fontWeight: 400,
                maxWidth: 560,
                fontSize: { xs: '1rem', md: '1.125rem' },
              }}
            >
              Encontre pousadas, hotéis e chalés nas cidades mais bonitas do Rio Grande do Norte.
            </Typography>

            <Typography
              variant="subtitle2"
              component="p"
              sx={{ color: 'rgba(255,255,255,0.86)', mb: 1.5 }}
            >
              Onde você quer ficar?
            </Typography>

            {/* Card de busca */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: 1,
                maxWidth: 720,
                bgcolor: 'background.paper',
                borderRadius: '16px',
                p: 1,
                boxShadow: (t) => `0 18px 44px ${alpha(t.palette.common.black, 0.22)}`,
              }}
            >
              <Autocomplete
                freeSolo
                fullWidth
                options={citiesData?.map((city: any) => city.nome) || []}
                inputValue={searchQuery}
                onInputChange={(event, newInputValue) => {
                  setSearchQuery(newInputValue);
                }}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setSearchQuery(newValue as string);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                renderInput={(params) => {
                  const { ...restParams } = params as any;
                  return (
                    <TextField
                      {...restParams}
                      placeholder="Buscar cidade, pousada, praia..."
                      variant="standard"
                      slotProps={{
                        ...params.slotProps,
                        htmlInput: {
                          ...params.slotProps?.htmlInput,
                          'aria-label': 'Buscar cidade ou hospedagem',
                        },
                        input: {
                          ...params.slotProps?.input,
                          disableUnderline: true,
                          startAdornment: (
                            <InputAdornment position="start" sx={{ pl: 2 }}>
                              <Search sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ '& input': { py: 1.5, fontSize: '1rem' } }}
                    />
                  );
                }}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleSearch}
                sx={{ flexShrink: 0, minWidth: { sm: 148 } }}
              >
                Buscar
              </Button>
            </Box>
          </Box>
        </PageContainer>

        {/* Indicadores do carrossel */}
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 20, md: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 1,
            zIndex: 3,
          }}
        >
          {heroImages.map((img, i) => (
            <Box
              key={img}
              component="button"
              type="button"
              aria-label={`Exibir imagem ${i + 1}`}
              aria-current={heroIndex === i ? 'true' : undefined}
              onClick={() => setHeroIndex(i)}
              sx={{
                width: heroIndex === i ? 28 : 8,
                height: 8,
                p: 0,
                border: 0,
                borderRadius: '999px',
                cursor: 'pointer',
                bgcolor:
                  heroIndex === i
                    ? 'common.white'
                    : (t) => alpha(t.palette.common.white, 0.45),
                transition: 'width 180ms, background-color 180ms',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* ===== DESTINOS ===== */}
      <PageContainer maxWidth="content" sx={{ py: { xs: 6, md: 8 } }}>
        <SectionHeading
          overline="Destinos"
          title="Explore as cidades do RN"
          subtitle="Cidades com história, cultura, gastronomia e belezas naturais para a sua próxima viagem."
          action={
            <Button
              onClick={() => navigate('/busca')}
              endIcon={<ArrowForward />}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Ver todas as hospedagens
            </Button>
          }
        />

        <Grid container spacing={3}>
          {!citiesData
            ? [...Array(6)].map((_, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                  <Skeleton variant="rounded" height={220} />
                </Grid>
              ))
            : citiesData.slice(0, 6).map((city: any) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={city.id}>
                  <Card
                    role="link"
                    tabIndex={0}
                    aria-label={`Ver hospedagens em ${city.nome}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/busca?cityId=${city.id}`);
                      }
                    }}
                    onClick={() => navigate(`/busca?cityId=${city.id}`)}
                    sx={{
                      position: 'relative',
                      height: 220,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 180ms, transform 180ms',
                      '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                    }}
                  >
                    {city.fotoPerfil ? (
                      <CardMedia
                        component="img"
                        image={`https://hospedarn-bucket.s3.us-east-2.amazonaws.com/cidades/${city.fotoPerfil}`}
                        alt={city.nome}
                        sx={{ height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <MediaFallback variant="city" />
                    )}
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: (t) =>
                          `linear-gradient(to top, ${alpha(t.palette.common.black, 0.72)} 0%, ${alpha(t.palette.common.black, 0.18)} 55%, transparent 100%)`,
                      }}
                    />
                    <Box sx={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                      <Typography variant="h5" component="h3" sx={{ color: 'common.white' }}>
                        {city.nome}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <Place aria-hidden sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.82)' }}>
                          {city._count?.estabelecimentos || 0}{' '}
                          {city._count?.estabelecimentos === 1 ? 'hospedagem' : 'hospedagens'}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
        </Grid>
      </PageContainer>

      {/* ===== HOSPEDAGENS EM DESTAQUE ===== */}
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <PageContainer maxWidth="content" gutterTop={false} sx={{ pb: 0 }}>
          <SectionHeading
            overline="Destaques"
            title="Hospedagens em destaque"
            subtitle="Opções bem avaliadas para diferentes estilos de viagem pelo estado."
            action={
              <Button onClick={() => navigate('/busca')} endIcon={<ArrowForward />}>
                Ver todas
              </Button>
            }
          />

          <Grid container spacing={3}>
            {loadingEst
              ? [...Array(6)].map((_, i) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                    <Skeleton variant="rounded" height={380} />
                  </Grid>
                ))
              : (establishmentsData ?? []).map((est: any) => {
                  const coverPhoto =
                    est.fotos?.find((p: any) => p.isCapa)?.url || est.fotos?.[0]?.url;
                  const price = minRoomPrice(est);

                  return (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={est.id}>
                      <Card
                        role="link"
                        tabIndex={0}
                        aria-label={`Ver detalhes de ${est.nome}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/hospedagem/${est.id}`);
                          }
                        }}
                        onClick={() => navigate(`/hospedagem/${est.id}`)}
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'border-color 180ms, box-shadow 180ms, transform 180ms',
                          '&:hover': {
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                            boxShadow: (t) => `0 8px 24px ${alpha(t.palette.text.primary, 0.08)}`,
                          },
                        }}
                      >
                        <Box sx={{ position: 'relative', height: 200, flexShrink: 0 }}>
                          {coverPhoto ? (
                            <CardMedia
                              component="img"
                              image={coverPhoto}
                              alt={est.nome}
                              sx={{ height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <MediaFallback variant="establishment" label={est.nome} />
                          )}
                          <FavoriteButton estabelecimentoId={est.id} nome={est.nome} />
                          {est.cidade?.nome && (
                            <Chip
                              label={est.cidade.nome}
                              icon={<Place sx={{ fontSize: 14 }} />}
                              size="small"
                              sx={{
                                position: 'absolute',
                                bottom: 12,
                                left: 12,
                                bgcolor: (t) => alpha(t.palette.common.black, 0.66),
                                color: 'common.white',
                                '& .MuiChip-icon': { color: 'common.white' },
                              }}
                            />
                          )}
                        </Box>

                        <CardContent
                          sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
                        >
                          <Typography variant="h6" component="h3" noWrap>
                            {est.nome}
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Rating
                              value={Number(est.notaMedia) || 0}
                              precision={0.5}
                              size="small"
                              readOnly
                            />
                            <Typography variant="caption" color="textSecondary">
                              {est.totalAvaliacoes
                                ? `${Number(est.notaMedia).toFixed(1)} (${est.totalAvaliacoes})`
                                : 'Sem avaliações'}
                            </Typography>
                          </Box>

                          {est.descricao && (
                            <Typography
                              variant="body2"
                              color="textSecondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {est.descricao}
                            </Typography>
                          )}

                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: 1,
                              mt: 'auto',
                              pt: 1.5,
                              borderTop: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ display: 'block' }}
                              >
                                A partir de
                              </Typography>
                              {price !== null ? (
                                <Typography variant="h6" color="primary">
                                  {formatCurrency(price)}
                                </Typography>
                              ) : (
                                <Typography variant="subtitle2" color="textSecondary">
                                  Sob consulta
                                </Typography>
                              )}
                            </Box>
                            <Button variant="contained" size="small">
                              Ver detalhes
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
          </Grid>
        </PageContainer>
      </Box>

      {/* ===== EVENTOS PRÓXIMOS ===== */}
      {eventsData && eventsData.length > 0 && (
        <PageContainer maxWidth="content" sx={{ py: { xs: 6, md: 8 } }}>
          <SectionHeading
            overline="Agenda"
            title="Eventos próximos"
            subtitle="Confira o que acontece no estado e planeje a estadia em volta do evento."
            action={
              <Button onClick={() => navigate('/eventos')} endIcon={<ArrowForward />}>
                Ver todos
              </Button>
            }
          />

          <Grid container spacing={3}>
            {eventsData.slice(0, 3).map((event: any) => {
              const { day, month } = eventDateParts(event.dataInicio);
              const coverUrl = eventCover(event)?.url ?? null;

              return (
                <Grid size={{ xs: 12, md: 4 }} key={event.id}>
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalhes e fotos do evento ${event.nome}`}
                    onClick={() => setDetailEvent(event as EventData)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailEvent(event as EventData);
                      }
                    }}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 180ms, box-shadow 180ms',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: (t) => `0 6px 20px ${t.palette.action.focus}`,
                      },
                    }}
                  >
                    {coverUrl && (
                      <Box sx={{ position: 'relative', height: 150, flexShrink: 0 }}>
                        <Box
                          component="img"
                          src={coverUrl}
                          alt={`Foto de capa do evento ${event.nome}`}
                          loading="lazy"
                          sx={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <Chip
                          label={`${day} ${month}`}
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            bgcolor: (t) => alpha(t.palette.common.black, 0.66),
                            color: 'common.white',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                          }}
                        />
                      </Box>
                    )}

                    <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      {!coverUrl && (
                        <Box
                          aria-hidden
                          sx={{
                            width: 56,
                            height: 64,
                            flexShrink: 0,
                            borderRadius: 3,
                            bgcolor: (t) => alpha(t.palette.secondary.main, 0.1),
                            color: 'secondary.main',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          <Typography variant="h5" component="span" sx={{ fontWeight: 800 }}>
                            {day}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="span"
                            sx={{ fontWeight: 700, letterSpacing: '0.08em', mt: 0.25 }}
                          >
                            {month}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
                          {event.nome}
                        </Typography>
                        {event.descricao && (
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              mb: 1,
                            }}
                          >
                            {event.descricao}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {event.eventosCidades?.slice(0, 2).map((ec: any) => (
                            <Chip
                              key={ec.cidade?.id}
                              label={ec.cidade?.nome}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </PageContainer>
      )}

      {/* Detalhes do evento — mesmo dialog da agenda, aberto direto daqui */}
      <EventDetailsDialog event={detailEvent} onClose={() => setDetailEvent(null)} />

      {/* ===== CTA FINAL (único gradiente além do hero) ===== */}
      <Box
        component="section"
        sx={{
          py: { xs: 8, md: 10 },
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
          color: 'primary.contrastText',
        }}
      >
        <PageContainer maxWidth="reading" gutterTop={false} sx={{ pb: 0, textAlign: 'center' }}>
          <EventIcon aria-hidden sx={{ fontSize: 44, opacity: 0.55, mb: 2 }} />
          <Typography variant="h2" component="h2" sx={{ mb: 2, color: 'inherit' }}>
            Quer viajar pelo Rio Grande do Norte?
          </Typography>
          <Typography
            variant="body1"
            sx={{ mb: 4, mx: 'auto', maxWidth: 560, color: 'inherit', opacity: 0.9 }}
          >
            Crie sua conta no HospedaRN e descubra as melhores hospedagens, eventos e destinos que o
            RN tem a oferecer.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/cadastro')}
              sx={{
                bgcolor: 'background.paper',
                color: 'primary.main',
                '&:hover': { bgcolor: 'background.paper', filter: 'brightness(0.97)' },
              }}
            >
              Criar conta gratuita
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/busca')}
              startIcon={<Search />}
              sx={{
                color: 'inherit',
                borderColor: (t) => alpha(t.palette.primary.contrastText, 0.5),
                '&:hover': {
                  borderColor: 'primary.contrastText',
                  bgcolor: (t) => alpha(t.palette.primary.contrastText, 0.12),
                },
              }}
            >
              Explorar hospedagens
            </Button>
          </Box>
        </PageContainer>
      </Box>
    </Box>
  );
}
