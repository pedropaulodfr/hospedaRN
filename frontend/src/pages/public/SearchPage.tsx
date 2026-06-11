import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Container, Grid, Typography, Button, TextField,
  InputAdornment, Card, CardContent, CardMedia, Rating, Chip,
  Skeleton, Slider, Checkbox, FormControlLabel, FormGroup,
  IconButton, Paper, Divider, Drawer, useTheme, useMediaQuery,
  Pagination
} from '@mui/material';
import {
  Search, LocationOn, Star, Wifi, Pool, LocalParking,
  FreeBreakfast, FilterList, Map, List, Clear, Tv, AcUnit,
  Kitchen, Pets, FitnessCenter, LocalBar, Restaurant, RoomService,
  Home, Place
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  citiesApi,
  amenitiesApi,
  accommodationTypesApi,
  establishmentsApi
} from '../../services/api';
import { useUIStore } from '../../stores/uiStore';

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
  'Wi-Fi': <Wifi fontSize="small" />,
  'Wifi': <Wifi fontSize="small" />,
  'Piscina': <Pool fontSize="small" />,
  'Estacionamento': <LocalParking fontSize="small" />,
  'Café da manhã': <FreeBreakfast fontSize="small" />,
  'Café da Manhã': <FreeBreakfast fontSize="small" />,
  'TV': <Tv fontSize="small" />,
  'Ar condicionado': <AcUnit fontSize="small" />,
  'Ar Condicionado': <AcUnit fontSize="small" />,
  'Frigobar': <Kitchen fontSize="small" />,
  'Pet friendly': <Pets fontSize="small" />,
  'Pet Friendly': <Pets fontSize="small" />,
  'Academia': <FitnessCenter fontSize="small" />,
  'Bar': <LocalBar fontSize="small" />,
  'Restaurante': <Restaurant fontSize="small" />,
  'Serviço de quarto': <RoomService fontSize="small" />,
};

const DEFAULT_CENTER: [number, number] = [-5.79448, -36.56806]; // RN Center
const DEFAULT_ZOOM = 8;

// Map controller to adjust bounds or center dynamically
function MapController({
  establishments,
  center,
  zoom,
}: {
  establishments: any[];
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (establishments && establishments.length > 0) {
      const validCoords = establishments
        .filter((est) => est.latitude && est.longitude)
        .map((est) => [Number(est.latitude), Number(est.longitude)] as [number, number]);

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        return;
      }
    }
    map.setView(center, zoom);
  }, [establishments, center, zoom, map]);

  return null;
}

export default function SearchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  // Search parameters from URL
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchFilters, setSearchFilters, clearSearchFilters } = useUIStore();

  // Local UI states
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showMapOnMobile, setShowMapOnMobile] = useState(false);
  const [page, setPage] = useState(1);
  const [priceRange, setPriceRange] = useState<number[]>([0, 1000]);

  // Sync URL query params with UI Store on mount and when query params change
  useEffect(() => {
    const filtersFromUrl: Record<string, any> = {};
    const cityId = searchParams.get('cityId');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minRating = searchParams.get('minRating');
    const amenityIds = searchParams.get('amenityIds');
    const accommodationTypeIds = searchParams.get('accommodationTypeIds');

    if (cityId) filtersFromUrl.cityId = cityId;
    if (search) filtersFromUrl.search = search;
    if (minPrice) filtersFromUrl.minPrice = Number(minPrice);
    if (maxPrice) filtersFromUrl.maxPrice = Number(maxPrice);
    if (minRating) filtersFromUrl.minRating = Number(minRating);
    if (amenityIds) filtersFromUrl.amenityIds = amenityIds;
    if (accommodationTypeIds) filtersFromUrl.accommodationTypeIds = accommodationTypeIds;

    // Only set if we actually have query params
    if (Object.keys(filtersFromUrl).length > 0) {
      setSearchFilters(filtersFromUrl);
    }
  }, [searchParams, setSearchFilters]);

  // Sync local price range when filters in store change
  useEffect(() => {
    const min = searchFilters.minPrice ?? 0;
    const max = searchFilters.maxPrice ?? 1000;
    setPriceRange([min, max]);
  }, [searchFilters.minPrice, searchFilters.maxPrice]);

  // Queries for static filter data
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: () => citiesApi.getAll(true),
    select: (res) => res.data.data,
  });

  const { data: amenities } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => amenitiesApi.getAll(),
    select: (res) => res.data?.data,
  });

  const { data: accommodationTypes } = useQuery({
    queryKey: ['accommodation-types'],
    queryFn: () => accommodationTypesApi.getAll(),
    select: (res) => res.data?.data,
  });

  // Calculate search API params
  const apiParams = {
    cidadeId: searchFilters.cityId || undefined,
    search: searchFilters.search || undefined,
    minPrice: searchFilters.minPrice ?? undefined,
    maxPrice: searchFilters.maxPrice ?? undefined,
    minRating: searchFilters.minRating ?? undefined,
    amenityIds: searchFilters.amenityIds || undefined,
    accommodationTypeIds: searchFilters.accommodationTypeIds || undefined,
    page,
    limit: 6,
  };

  // Query establishments
  const { data: resultsData, isLoading: loadingResults } = useQuery({
    queryKey: ['search-establishments', apiParams],
    queryFn: () => establishmentsApi.getAll(apiParams),
    select: (res) => res.data,
  });

  const establishments = resultsData?.data?.data || [];
  const totalPages = resultsData?.data?.totalPages || 1;
  const totalItems = resultsData?.data?.total || 0;

  // Determine current map center
  const selectedCity = cities?.find(
    (c: any) =>
      c.id === searchFilters.cityId ||
      c.nome.trim().toLowerCase() === searchFilters.search?.trim().toLowerCase()
  );
  const mapCenter: [number, number] = selectedCity
    ? [Number(selectedCity.latitude), Number(selectedCity.longitude)]
    : DEFAULT_CENTER;
  const mapZoom = selectedCity ? 12 : DEFAULT_ZOOM;

  // Update URL params helper
  const updateUrlParams = (newFilters: Record<string, any>) => {
    const params: Record<string, string> = {};
    Object.entries({ ...searchFilters, ...newFilters }).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params[key] = String(val);
      }
    });
    setSearchParams(params);
  };

  // Filter handlers
  const handleTextSearch = (val: string) => {
    setSearchFilters({ search: val });
    updateUrlParams({ search: val });
    setPage(1);
  };

  const handleCityChange = (cityId: string) => {
    const id = cityId === 'all' ? '' : cityId;
    setSearchFilters({ cityId: id });
    updateUrlParams({ cityId: id });
    setPage(1);
  };

  const handlePriceChange = (_event: Event | React.SyntheticEvent, newValue: number | number[]) => {
    setPriceRange(newValue as number[]);
  };

  const handlePriceCommit = () => {
    setSearchFilters({ minPrice: priceRange[0], maxPrice: priceRange[1] });
    updateUrlParams({ minPrice: priceRange[0], maxPrice: priceRange[1] });
    setPage(1);
  };

  const handleRatingChange = (rating: number | null) => {
    const val = rating === null ? undefined : rating;
    setSearchFilters({ minRating: val });
    updateUrlParams({ minRating: val });
    setPage(1);
  };

  const handleAmenityToggle = (id: string) => {
    const currentList = searchFilters.amenityIds ? searchFilters.amenityIds.split(',').filter(Boolean) : [];
    const newList = currentList.includes(id)
      ? currentList.filter((x: string) => x !== id)
      : [...currentList, id];

    const val = newList.join(',');
    setSearchFilters({ amenityIds: val });
    updateUrlParams({ amenityIds: val });
    setPage(1);
  };

  const handleAccommodationTypeToggle = (id: string) => {
    const currentList = searchFilters.accommodationTypeIds ? searchFilters.accommodationTypeIds.split(',').filter(Boolean) : [];
    const newList = currentList.includes(id)
      ? currentList.filter((x: string) => x !== id)
      : [...currentList, id];

    const val = newList.join(',');
    setSearchFilters({ accommodationTypeIds: val });
    updateUrlParams({ accommodationTypeIds: val });
    setPage(1);
  };

  const handleClearFilters = () => {
    clearSearchFilters();
    setSearchParams({});
    setPage(1);
    setPriceRange([0, 1000]);
  };

  // Render the filters form
  const renderFiltersContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Top action header for filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Filtros
        </Typography>
        <Button
          size="small"
          onClick={handleClearFilters}
          startIcon={<Clear />}
          sx={{ color: 'secondary.main' }}
        >
          Limpar
        </Button>
      </Box>

      {/* Text Search */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Buscar por nome/palavra-chave
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Ex: Pousada do Sol, Pipa..."
          value={searchFilters.search || ''}
          onChange={(e) => handleTextSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }
          }}
        />
      </Box>

      <Divider />

      {/* City filter */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Cidade
        </Typography>
        <TextField
          select
          fullWidth
          size="small"
          value={searchFilters.cityId || 'all'}
          onChange={(e) => handleCityChange(e.target.value)}
          slotProps={{
            select: {
              native: true
            }
          }}
        >
          <option value="all">Todas as cidades</option>
          {cities?.map((city: any) => (
            <option key={city.id} value={city.id}>
              {city.nome}
            </option>
          ))}
        </TextField>
      </Box>

      <Divider />

      {/* Price Slider */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Preço base por diária
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={priceRange}
            onChange={handlePriceChange}
            onChangeCommitted={handlePriceCommit}
            valueLabelDisplay="auto"
            min={0}
            max={1500}
            step={50}
            color="primary"
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            R$ {priceRange[0]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            R$ {priceRange[1] === 1500 ? 'R$ 1500+' : `R$ ${priceRange[1]}`}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Rating Filter */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          Avaliação mínima
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[5, 4, 3, 2].map((stars) => {
            const isSelected = searchFilters.minRating === stars;
            return (
              <Button
                key={stars}
                variant={isSelected ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleRatingChange(isSelected ? null : stars)}
                sx={{
                  justifyContent: 'flex-start',
                  borderColor: isSelected ? 'primary.main' : 'rgba(0,0,0,0.08)',
                  color: isSelected ? 'white' : 'text.primary',
                  bgcolor: isSelected ? 'primary.main' : 'transparent',
                  '&:hover': {
                    bgcolor: isSelected ? 'primary.dark' : 'rgba(0,151,167,0.04)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Rating value={stars} readOnly size="small" sx={{ mr: 1 }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {stars === 5 ? '5 estrelas' : `Ou mais`}
                </Typography>
              </Button>
            );
          })}
        </Box>
      </Box>

      <Divider />

      {/* Accommodation Types */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Tipos de acomodação
        </Typography>
        <FormGroup sx={{ maxHeight: 200, overflowY: 'auto' }}>
          {accommodationTypes?.map((type: any) => {
            const isChecked = searchFilters.accommodationTypeIds
              ?.split(',')
              .includes(type.id);
            return (
              <FormControlLabel
                key={type.id}
                control={
                  <Checkbox
                    size="small"
                    checked={!!isChecked}
                    onChange={() => handleAccommodationTypeToggle(type.id)}
                  />
                }
                label={
                  <Typography variant="body2" color="text.primary">
                    {type.nome}
                  </Typography>
                }
              />
            );
          })}
        </FormGroup>
      </Box>

      <Divider />

      {/* Amenities (Vantagens) */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Comodidades & Vantagens
        </Typography>
        <FormGroup sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {amenities?.map((amenity: any) => {
            const isChecked = searchFilters.amenityIds?.split(',').includes(amenity.id);
            return (
              <FormControlLabel
                key={amenity.id}
                control={
                  <Checkbox
                    size="small"
                    checked={!!isChecked}
                    onChange={() => handleAmenityToggle(amenity.id)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {AMENITY_ICONS[amenity.nome] || <Home fontSize="small" />}
                    <Typography variant="body2" color="text.primary">
                      {amenity.nome}
                    </Typography>
                  </Box>
                }
              />
            );
          })}
        </FormGroup>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pt: { xs: 8, md: 10 } }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          {/* ================= SIDEBAR FILTERS (DESKTOP) ================= */}
          {!isMobile && (
            <Grid size={{ xs: 12, md: 3 }}>
              <Paper
                elevation={1}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: '1px solid rgba(0,0,0,0.05)',
                  position: 'sticky',
                  top: 96,
                  maxHeight: 'calc(100vh - 128px)',
                  overflowY: 'auto',
                }}
              >
                {renderFiltersContent()}
              </Paper>
            </Grid>
          )}

          {/* ================= RESULTS LIST ================= */}
          <Grid size={{ xs: 12, md: showMapOnMobile ? 12 : 5, lg: showMapOnMobile ? 12 : 5 }}>
            {/* Header info bar */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  Hospedagens no RN
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {loadingResults ? (
                    <Skeleton width={180} />
                  ) : (
                    `${totalItems} opções encontradas para sua viagem`
                  )}
                </Typography>
              </Box>

              {/* Mobile Filter & Map Toggle Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {isMobile && (
                  <Button
                    variant="outlined"
                    startIcon={<FilterList />}
                    onClick={() => setMobileFiltersOpen(true)}
                    size="small"
                  >
                    Filtros
                  </Button>
                )}

                {isMobile && (
                  <Button
                    variant="contained"
                    startIcon={showMapOnMobile ? <List /> : <Map />}
                    onClick={() => setShowMapOnMobile(!showMapOnMobile)}
                    size="small"
                  >
                    {showMapOnMobile ? 'Ver Lista' : 'Ver Mapa'}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Results Grid */}
            {showMapOnMobile ? (
              // Map container for mobile when active
              <Box sx={{ height: '70vh', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                {renderMap()}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {loadingResults
                  ? [...Array(3)].map((_, i) => (
                      <Card key={i} sx={{ display: 'flex', height: { xs: 'auto', sm: 200 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Skeleton variant="rectangular" width={220} height="100%" />
                        <CardContent sx={{ flex: 1, p: 3 }}>
                          <Skeleton width="60%" height={32} sx={{ mb: 2 }} />
                          <Skeleton width="40%" sx={{ mb: 1 }} />
                          <Skeleton width="80%" sx={{ mb: 2 }} />
                          <Skeleton width="30%" height={40} />
                        </CardContent>
                      </Card>
                    ))
                  : establishments.length === 0
                  ? renderEmptyState()
                  : establishments.map((est: any) => renderEstablishmentCard(est))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_e, p) => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      color="primary"
                      size="large"
                    />
                  </Box>
                )}
              </Box>
            )}
          </Grid>

          {/* ================= INTERACTIVE MAP VIEW (DESKTOP) ================= */}
          {!isMobile && (
            <Grid size={{ xs: 12, md: 4, lg: 4 }}>
              <Box
                sx={{
                  position: 'sticky',
                  top: 96,
                  height: 'calc(100vh - 128px)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  bgcolor: 'background.paper',
                }}
              >
                {renderMap()}
              </Box>
            </Grid>
          )}
        </Grid>
      </Container>

      {/* ================= MOBILE FILTERS DRAWER ================= */}
      <Drawer
        anchor="bottom"
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              p: 3,
              maxHeight: '85vh',
              overflowY: 'auto',
            },
          },
        }}
      >
        {renderFiltersContent()}
        <Button
          variant="contained"
          fullWidth
          onClick={() => setMobileFiltersOpen(false)}
          sx={{ mt: 4, py: 1.5 }}
        >
          Aplicar Filtros
        </Button>
      </Drawer>
    </Box>
  );

  // Sub-render: Empty state illustration
  function renderEmptyState() {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 4,
          border: '1px dashed rgba(0,0,0,0.15)',
          bgcolor: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <LocationOn sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Nenhuma hospedagem encontrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 3 }}>
          Tente ajustar os filtros ou digitar um termo diferente na busca.
        </Typography>
        <Button variant="contained" size="small" onClick={handleClearFilters}>
          Limpar todos os filtros
        </Button>
      </Paper>
    );
  }

  // Sub-render: Map component
  function renderMap() {
    return (
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController establishments={establishments} center={mapCenter} zoom={mapZoom} />

        {establishments
          .filter((est: any) => est.latitude && est.longitude)
          .map((est: any) => {
            const minPrice = est.quartos && est.quartos.length > 0
              ? Math.min(...est.quartos.map((r: any) => Number(r.precoBase)))
              : null;
            const coverPhoto = est.fotos?.find((p: any) => p.isCapa)?.url
              || est.fotos?.[0]?.url
              || 'https://placehold.co/200x200/0097A7/FFFFFF?text=H';

            return (
              <Marker key={est.id} position={[Number(est.latitude), Number(est.longitude)]}>
                <Popup>
                  <Box sx={{ width: 180, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <CardMedia
                      component="img"
                      image={coverPhoto}
                      alt={est.nome}
                      sx={{ height: 100, borderRadius: 1.5, objectFit: 'cover' }}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {est.nome}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Star sx={{ fontSize: 14, color: 'warning.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {Number(est.notaMedia).toFixed(1)}
                      </Typography>
                    </Box>
                    {minPrice !== null ? (
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        Diárias a partir de R$ {minPrice}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Preço sob consulta
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => navigate(`/hospedagem/${est.id}`)}
                      sx={{ py: 0.5, fontSize: '0.75rem', mt: 0.5 }}
                    >
                      Ver detalhes
                    </Button>
                  </Box>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    );
  }

  // Sub-render: Establishment Card
  function renderEstablishmentCard(est: any) {
    const minPrice = est.quartos && est.quartos.length > 0
      ? Math.min(...est.quartos.map((r: any) => Number(r.precoBase)))
      : null;

    const coverPhoto = est.fotos?.find((p: any) => p.isCapa)?.url
      || est.fotos?.[0]?.url
      || 'https://placehold.co/500x300/0097A7/FFFFFF?text=HospedaRN';

    // Extract unique room type names for display
    const roomTypesList = Array.from(
      new Set(est.quartos?.map((r: any) => r.tipoAcomodacao?.nome).filter(Boolean))
    );

    return (
      <Card
        key={est.id}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          height: { xs: 'auto', sm: 240 },
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.05)',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            transform: 'translateY(-2px)',
          },
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        }}
        onClick={() => navigate(`/hospedagem/${est.id}`)}
      >
        {/* Cover Photo */}
        <Box sx={{ width: { xs: '100%', sm: 220 }, height: { xs: 180, sm: '100%' }, position: 'relative', flexShrink: 0 }}>
          <CardMedia
            component="img"
            image={coverPhoto}
            alt={est.nome}
            sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
          />
          <Chip
            label={est.cidade?.nome}
            icon={<LocationOn sx={{ fontSize: '12px !important' }} />}
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              '& .MuiChip-icon': { color: 'primary.light' },
            }}
          />
        </Box>

        {/* Content details */}
        <CardContent
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
          }}
        >
          <Box>
            {/* Title & Rating */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {est.nome}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {Number(est.notaMedia).toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({est.totalAvaliacoes})
                </Typography>
              </Box>
            </Box>

            {/* Room type label / chips */}
            {roomTypesList.length > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
                {roomTypesList.join(' • ')}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Hospedagem
              </Typography>
            )}

            {/* Amenities summary icons */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              {est.comodidades?.slice(0, 4).map((ea: any) => (
                <Chip
                  key={ea.comodidade.id}
                  icon={AMENITY_ICONS[ea.comodidade.nome] || <Home fontSize="small" />}
                  label={ea.comodidade.nome}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: 'rgba(0,0,0,0.06)',
                    fontSize: '0.7rem',
                    bgcolor: 'rgba(0,151,167,0.02)',
                    '& .MuiChip-icon': { color: 'primary.main' }
                  }}
                />
              ))}
              {est.comodidades?.length > 4 && (
                <Chip
                  label={`+${est.comodidades.length - 4}`}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: 'rgba(0,0,0,0.06)', fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>

          {/* Pricing & CTA */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              pt: 1.5,
              borderTop: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Diárias a partir de
              </Typography>
              {minPrice !== null ? (
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 800 }}>
                  R$ {minPrice}
                </Typography>
              ) : (
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Sob consulta
                </Typography>
              )}
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/hospedagem/${est.id}`);
              }}
              sx={{ borderRadius: 2 }}
            >
              Ver detalhes
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }
}
