import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent,
  CardMedia, TextField, InputAdornment, Chip, Avatar, Rating,
  Skeleton, useTheme, alpha, IconButton, Autocomplete,
} from '@mui/material';
import {
  Search, LocationOn, TravelExplore, BeachAccess, Star,
  ArrowForward, WifiTethering, Pool, LocalParking, FreeBreakfast,
  Favorite, Place, Event,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { citiesApi, establishmentsApi, eventsApi } from '../../services/api';
import { useUIStore } from '../../stores/uiStore';

const heroImages = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1600&q=80',
];

import React from 'react';

const amenityIcons: Record<string, React.ReactNode> = {
  'Wi-Fi': <WifiTethering />,
  'Piscina': <Pool />,
  'Estacionamento': <LocalParking />,
  'Café da manhã': <FreeBreakfast />,
};

export default function HomePage() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { setSearchFilters } = useUIStore();
  const theme = useTheme();

  // Rotate hero images
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

  const { data: establishmentsData, isLoading: loadingEst } = useQuery({
    queryKey: ['establishments-featured'],
    queryFn: () => establishmentsApi.getAll({ limit: 6 }),
    select: (res) => res.data.data?.data,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events-upcoming'],
    queryFn: () => eventsApi.getAll(true),
    select: (res) => res.data.data,
  });

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
      {/* ===== HERO SECTION ===== */}
      <Box
        sx={{
          position: 'relative', minHeight: '92vh',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background image with transition */}
        {heroImages.map((img, index) => (
          <Box
            key={img}
            sx={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              transition: 'opacity 1.5s ease',
              opacity: heroIndex === index ? 1 : 0,
            }}
          />
        ))}

        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(0,20,40,0.85) 0%, rgba(0,151,167,0.4) 50%, rgba(255,112,67,0.3) 100%)',
          }}
        />

        {/* Animated particles */}
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[...Array(6)].map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: `${Math.random() * 300 + 100}px`,
                height: `${Math.random() * 300 + 100}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, rgba(0,188,212,0.1), transparent)`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${5 + i}s ease-in-out infinite alternate`,
                '@keyframes float': {
                  '0%': { transform: 'translateY(0px)' },
                  '100%': { transform: 'translateY(-30px)' },
                },
              }}
            />
          ))}
        </Box>

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, py: 8 }}>
          <Box sx={{ maxWidth: 780 }}>
            {/* Tagline */}
            <Chip
              icon={<BeachAccess sx={{ color: '#FF7043 !important' }} />}
              label="Descubra o Rio Grande do Norte"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)', color: 'white',
                backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                fontWeight: 600, mb: 3, fontSize: '0.875rem',
              }}
            />

            {/* Headline */}
            <Typography
              variant="h1"
              sx={{
                color: 'white', fontFamily: '"Outfit", sans-serif',
                fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem', lg: '5rem' },
                lineHeight: 1.1, mb: 2,
                textShadow: '0 2px 30px rgba(0,0,0,0.4)',
              }}
            >
              Sua próxima
              <Box component="span" sx={{ color: '#00BCD4', display: 'block' }}>
                aventura no RN
              </Box>
              começa aqui
            </Typography>

            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.85)', mb: 5,
                fontWeight: 400, maxWidth: 560, lineHeight: 1.6,
                fontSize: { xs: '1rem', md: '1.25rem' },
              }}
            >
              Encontre pousadas, hotéis e chalés nas cidades mais bonitas do Rio Grande do Norte.
            </Typography>

            {/* Search Box */}
            <Box
              sx={{
                display: 'flex', gap: 0, alignItems: 'center',
                bgcolor: 'white', borderRadius: 3, p: 1,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxWidth: 680,
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
                  const { InputProps, ...restParams } = params as any;
                  return (
                    <TextField
                      {...restParams}
                      placeholder="Buscar cidade, pousada, praia..."
                      variant="standard"
                      slotProps={{
                        ...params.slotProps,
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
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleSearch}
                sx={{
                  borderRadius: 2.5, px: 4, py: 1.5, ml: 1, minWidth: 140,
                  background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                  flexShrink: 0,
                }}
              >
                Buscar
              </Button>
            </Box>

            {/* Quick stats */}
            <Box sx={{ display: 'flex', gap: 4, mt: 5 }}>
              {[
                { value: '200+', label: 'Hospedagens' },
                { value: '30+', label: 'Cidades' },
                { value: '4.8★', label: 'Avaliação média' },
              ].map((stat) => (
                <Box key={stat.label}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#00BCD4' }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        {/* Hero dots */}
        <Box sx={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
          {heroImages.map((_, i) => (
            <Box
              key={i}
              onClick={() => setHeroIndex(i)}
              sx={{
                width: heroIndex === i ? 28 : 8, height: 8,
                borderRadius: 4, bgcolor: heroIndex === i ? 'white' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* ===== CITIES SECTION ===== */}
      <Container maxWidth="xl" sx={{ py: 10 }}>
        <Box sx={{ mb: 6 }}>
          <Chip label="Destinos" color="primary" sx={{ mb: 1.5, fontWeight: 600 }} />
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Explore as cidades do RN
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
            Explore cidades repletas de história, cultura, gastronomia e belezas naturais.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {citiesData?.slice(0, 6).map((city: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={city.id}>
              <Card
                onClick={() => navigate(`/busca?cityId=${city.id}`)}
                sx={{
                  cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                  position: 'relative', height: 220,
                  '&:hover .overlay': { opacity: 0.7 },
                  '&:hover .city-name': { bottom: 20 },
                }}
              >
                <CardMedia
                  component="img"
                  image={city.fotoPerfil ? `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/cidades/${city.fotoPerfil}` : `https://placehold.co/400x220/0097A7/FFFFFF?text=${encodeURIComponent(city.nome)}`}
                  alt={city.nome}
                  sx={{ height: '100%', objectFit: 'cover' }}
                />
                <Box
                  className="overlay"
                  sx={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                    transition: 'opacity 0.3s',
                  }}
                />
                <Box
                  className="city-name"
                  sx={{
                    position: 'absolute', bottom: 16, left: 16, right: 16,
                    transition: 'bottom 0.3s ease',
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                    {city.nome}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Place sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }} />
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      {city._count?.estabelecimentos || 0} hospedagens
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          )) || [...Array(6)].map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ===== FEATURED ESTABLISHMENTS ===== */}
      <Box sx={{ bgcolor: 'rgba(0,151,167,0.03)', py: 10 }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 6 }}>
            <Box>
              <Chip label="Destaques" sx={{ bgcolor: '#FF7043', color: 'white', mb: 1.5, fontWeight: 600 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>Hospedagens em destaque</Typography>
            </Box>
            <Button
              onClick={() => navigate('/busca')}
              endIcon={<ArrowForward />}
              sx={{ display: { xs: 'none', md: 'flex' } }}
            >
              Ver todas
            </Button>
          </Box>

          <Grid container spacing={3}>
            {loadingEst
              ? [...Array(6)].map((_, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                  <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 3 }} />
                </Grid>
              ))
              : establishmentsData?.map((est: any) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={est.id}>
                  <Card
                    onClick={() => navigate(`/hospedagem/${est.id}`)}
                    sx={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Image */}
                    <Box sx={{ position: 'relative', height: 200 }}>
                      <CardMedia
                        component="img"
                        image={est.fotos?.find((p: any) => p.isCapa)?.url || est.fotos?.[0]?.url || 'https://placehold.co/400x200/0097A7/FFFFFF?text=HospedaRN'}
                        alt={est.nome}
                        sx={{ height: '100%', objectFit: 'cover' }}
                      />
                      <IconButton
                        sx={{
                          position: 'absolute', top: 8, right: 8,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          '&:hover': { bgcolor: 'white' },
                        }}
                        size="small"
                      >
                        <Favorite sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </IconButton>
                      <Chip
                        label={est.cidade?.nome}
                        icon={<LocationOn sx={{ fontSize: '12px !important' }} />}
                        size="small"
                        sx={{
                          position: 'absolute', bottom: 8, left: 8,
                          bgcolor: 'rgba(0,0,0,0.7)', color: 'white',
                          '& .MuiChip-icon': { color: '#00BCD4' },
                        }}
                      />
                    </Box>

                    <CardContent sx={{ flex: 1, p: 2.5 }}>
                      <Typography variant="h6" gutterBottom noWrap sx={{ fontWeight: 700 }}>
                        {est.nome}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                        <Rating value={Number(est.notaMedia)} precision={0.5} size="small" readOnly />
                        <Typography variant="caption" color="text.secondary">
                          ({est.totalAvaliacoes})
                        </Typography>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 2,
                      }}>
                        {est.descricao || 'Uma ótima opção de hospedagem no coração do RN.'}
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">A partir de</Typography>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>
                            R$ 150
                          </Typography>
                        </Box>
                        <Button variant="contained" size="small" sx={{ borderRadius: 2 }}>
                          Ver detalhes
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Container>
      </Box>

      {/* ===== EVENTS SECTION ===== */}
      {eventsData && eventsData.length > 0 && (
        <Container maxWidth="xl" sx={{ py: 10 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 6 }}>
            <Box>
              <Chip label="Agenda" color="secondary" sx={{ mb: 1.5, fontWeight: 600 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>Eventos próximos</Typography>
            </Box>
            <Button onClick={() => navigate('/eventos')} endIcon={<ArrowForward />}>
              Ver todos
            </Button>
          </Box>

          <Grid container spacing={3}>
            {eventsData.slice(0, 3).map((event: any) => (
              <Grid size={{ xs: 12, md: 4 }} key={event.id}>
                <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Box sx={{ height: 8, background: 'linear-gradient(90deg, #FF7043, #FF8A65)' }} />
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 56, height: 56, borderRadius: 2,
                          background: 'linear-gradient(135deg, #FF7043, #FF8A65)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', lineHeight: 1 }}>
                          {new Date(event.dataInicio).getDate()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                          {new Date(event.dataInicio).toLocaleString('pt-BR', { month: 'short' })}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>{event.nome}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {event.descricao?.slice(0, 80)}...
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {event.eventosCidades?.slice(0, 2).map((ec: any) => (
                            <Chip key={ec.cidade?.id} label={ec.cidade?.nome} size="small" variant="outlined" color="secondary" />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* ===== CTA SECTION ===== */}
      <Box
        sx={{
          py: 12,
          background: 'linear-gradient(135deg, #0097A7 0%, #006978 50%, #1A2332 100%)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0,188,212,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,112,67,0.15) 0%, transparent 50%)',
        }} />
        <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative' }}>
          <BeachAccess sx={{ fontSize: 60, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
          <Typography variant="h2" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>
            Quer viajar pelo Rio Grande do Norte?
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 5, fontWeight: 400 }}>
            Crie sua conta no HospedaRN e descubra as melhores hospedagens, eventos
            e destinos que o RN tem a oferecer.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/cadastro')}
              sx={{
                bgcolor: 'white', color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                px: 4, py: 1.75,
              }}
            >
              Criar conta gratuita
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/busca')}
              sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', px: 4, py: 1.75 }}
            >
              Explorar hospedagens
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
