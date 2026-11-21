import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CardMedia,
  Rating,
  Chip,
  Slider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  Divider,
  Drawer,
  Pagination,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  LocationOn,
  Star,
  Wifi,
  Pool,
  LocalParking,
  FreeBreakfast,
  FilterList,
  Map,
  List,
  Clear,
  Tv,
  AcUnit,
  Kitchen,
  Pets,
  FitnessCenter,
  LocalBar,
  Restaurant,
  RoomService,
  Home,
  Close,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  citiesApi,
  amenitiesApi,
  accommodationTypesApi,
  establishmentsApi,
} from '../../services/api';
import { useUIStore } from '../../stores/uiStore';
import {
  PageContainer,
  PageHeader,
  SectionCard,
  DataToolbar,
  DataToolbarGroup,
  SearchField,
  EmptyState,
  ErrorState,
  CardGridSkeleton,
  EmptySearchIcon,
  MediaFallback,
} from '../../components/common';
import { FavoriteButton } from '../../components/favorites/FavoriteButton';
import { formatCurrency } from '../../theme/tokens';

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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
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
  const {
    data: resultsData,
    isLoading: loadingResults,
    isError: errorResults,
    refetch: refetchResults,
  } = useQuery({
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

  const handlePriceClear = () => {
    setSearchFilters({ minPrice: undefined, maxPrice: undefined });
    updateUrlParams({ minPrice: undefined, maxPrice: undefined });
    setPriceRange([0, 1000]);
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

  const hasActiveFilters = Boolean(
    searchFilters.search ||
      searchFilters.cityId ||
      searchFilters.minPrice !== undefined ||
      searchFilters.maxPrice !== undefined ||
      searchFilters.minRating !== undefined ||
      searchFilters.amenityIds ||
      searchFilters.accommodationTypeIds
  );

  // Chips removíveis dos filtros ativos (fonte: estado real da busca)
  const activeFilterChips: { key: string; label: string; onDelete: () => void }[] = [];
  if (searchFilters.search) {
    activeFilterChips.push({
      key: 'search',
      label: `Busca: ${searchFilters.search}`,
      onDelete: () => handleTextSearch(''),
    });
  }
  if (searchFilters.cityId) {
    const city = cities?.find((c: any) => c.id === searchFilters.cityId);
    activeFilterChips.push({
      key: 'city',
      label: `Cidade: ${city?.nome ?? 'selecionada'}`,
      onDelete: () => handleCityChange('all'),
    });
  }
  if (searchFilters.minPrice !== undefined || searchFilters.maxPrice !== undefined) {
    const min = searchFilters.minPrice ?? 0;
    const max = searchFilters.maxPrice;
    activeFilterChips.push({
      key: 'price',
      label:
        max !== undefined
          ? `Diária: ${formatCurrency(min)} – ${formatCurrency(max)}`
          : `Diária a partir de ${formatCurrency(min)}`,
      onDelete: handlePriceClear,
    });
  }
  if (searchFilters.minRating !== undefined) {
    activeFilterChips.push({
      key: 'rating',
      label: `Nota ${searchFilters.minRating}+`,
      onDelete: () => handleRatingChange(null),
    });
  }
  (searchFilters.amenityIds ? searchFilters.amenityIds.split(',').filter(Boolean) : []).forEach(
    (id: string) => {
      const nome = amenities?.find((a: any) => a.id === id)?.nome;
      activeFilterChips.push({
        key: `amenity-${id}`,
        label: nome ?? 'Comodidade',
        onDelete: () => handleAmenityToggle(id),
      });
    }
  );
  (
    searchFilters.accommodationTypeIds
      ? searchFilters.accommodationTypeIds.split(',').filter(Boolean)
      : []
  ).forEach((id: string) => {
    const nome = accommodationTypes?.find((t: any) => t.id === id)?.nome;
    activeFilterChips.push({
      key: `type-${id}`,
      label: nome ?? 'Tipo de acomodação',
      onDelete: () => handleAccommodationTypeToggle(id),
    });
  });

  // Render the filters form (compartilhado entre sidebar desktop e drawer mobile)
  const renderFiltersFields = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* City filter */}
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
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
              native: true,
            },
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
        <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
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
            aria-label="Faixa de preço por diária"
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="textSecondary">
            {formatCurrency(priceRange[0])}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {formatCurrency(priceRange[1])}
            {priceRange[1] === 1500 ? '+' : ''}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Rating Filter */}
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
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
                aria-pressed={isSelected}
                sx={{
                  justifyContent: 'flex-start',
                  width: '100%',
                  gap: 1,
                  px: 1.25,
                  color: isSelected ? 'primary.contrastText' : 'text.primary',
                }}
              >
                <Rating value={stars} readOnly size="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {stars}+ estrelas
                </Typography>
              </Button>
            );
          })}
        </Box>
      </Box>

      <Divider />

      {/* Accommodation Types */}
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          Tipos de acomodação
        </Typography>
        {/* flexWrap: nowrap — o padrão do MUI é `wrap`, que com maxHeight
            quebra em colunas e estoura a largura do painel de filtros. */}
        <FormGroup sx={{ maxHeight: 180, overflowY: 'auto', flexWrap: 'nowrap' }}>
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
                  <Typography variant="body2" color="textPrimary">
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
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          Comodidades & vantagens
        </Typography>
        <FormGroup sx={{ maxHeight: 220, overflowY: 'auto', flexWrap: 'nowrap' }}>
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
                    <Typography variant="body2" color="textPrimary">
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
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Busca"
        title="Hospedagens no Rio Grande do Norte"
        subtitle="Compare cidades, comodidades e diárias para encontrar a estadia certa."
        actions={
          <>
            {isMobile && (
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setMobileFiltersOpen(true)}
              >
                Filtros
                {activeFilterChips.length > 0 ? ` (${activeFilterChips.length})` : ''}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={viewMode === 'map' ? <List /> : <Map />}
              onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            >
              {viewMode === 'map' ? 'Ver lista' : 'Ver mapa'}
            </Button>
          </>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={searchFilters.search || ''}
            onChange={handleTextSearch}
            placeholder="Buscar por nome, cidade ou palavra-chave"
            width={380}
          />
        </DataToolbarGroup>
        <Typography variant="body2" color="textSecondary" component="p">
          {loadingResults
            ? 'Buscando hospedagens…'
            : `${totalItems} ${totalItems === 1 ? 'hospedagem encontrada' : 'hospedagens encontradas'}`}
        </Typography>
      </DataToolbar>

      {activeFilterChips.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            mb: 2.5,
          }}
        >
          {activeFilterChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              size="small"
              variant="outlined"
              onDelete={chip.onDelete}
              sx={{ bgcolor: 'background.paper' }}
            />
          ))}
          <Button size="small" startIcon={<Clear />} onClick={handleClearFilters}>
            Limpar filtros
          </Button>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* ================= SIDEBAR FILTERS (DESKTOP) ================= */}
        {!isMobile && (
          <Grid size={{ xs: 12, md: 3 }}>
            <SectionCard
              title="Filtros"
              action={
                hasActiveFilters ? (
                  <Button size="small" startIcon={<Clear />} onClick={handleClearFilters}>
                    Limpar
                  </Button>
                ) : undefined
              }
              contentSx={{ p: 2.5 }}
              sx={{
                position: 'sticky',
                top: 96,
                maxHeight: 'calc(100vh - 128px)',
                overflowY: 'auto',
              }}
            >
              {renderFiltersFields()}
            </SectionCard>
          </Grid>
        )}

        {/* ================= RESULTS ================= */}
        <Grid size={{ xs: 12, md: 9 }}>
          {viewMode === 'map' ? (
            <Box
              sx={{
                height: { xs: '62vh', md: 'calc(100vh - 220px)' },
                minHeight: 420,
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {renderMap()}
            </Box>
          ) : loadingResults ? (
            <CardGridSkeleton count={6} height={340} />
          ) : errorResults ? (
            <ErrorState
              title="Não foi possível carregar as hospedagens"
              description="Ocorreu uma falha ao buscar os resultados. Verifique sua conexão e tente novamente."
              onRetry={() => refetchResults()}
            />
          ) : establishments.length === 0 ? (
            <EmptyState
              icon={EmptySearchIcon}
              title="Nenhuma hospedagem encontrada"
              description="Tente ajustar os filtros ou buscar por outra cidade, comodidade ou faixa de preço."
              action={
                <Button variant="contained" onClick={handleClearFilters}>
                  Limpar todos os filtros
                </Button>
              }
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {establishments.map((est: any) => renderEstablishmentCard(est))}
            </Box>
          )}

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
                shape="rounded"
              />
            </Box>
          )}
        </Grid>
      </Grid>

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
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" component="h2">
            Filtros
          </Typography>
          <IconButton aria-label="Fechar filtros" onClick={() => setMobileFiltersOpen(false)}>
            <Close />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, py: 2.5, overflowY: 'auto', flex: 1 }}>{renderFiltersFields()}</Box>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            px: 3,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Button variant="outlined" onClick={handleClearFilters} sx={{ flex: 1 }}>
            Limpar
          </Button>
          <Button
            variant="contained"
            onClick={() => setMobileFiltersOpen(false)}
            sx={{ flex: 1 }}
          >
            Aplicar filtros
          </Button>
        </Box>
      </Drawer>
    </PageContainer>
  );

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
              || est.fotos?.[0]?.url;

            return (
              <Marker key={est.id} position={[Number(est.latitude), Number(est.longitude)]}>
                <Popup>
                  <Box sx={{ width: 180, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ height: 100, borderRadius: 1.5, overflow: 'hidden' }}>
                      {coverPhoto ? (
                        <CardMedia
                          component="img"
                          image={coverPhoto}
                          alt={est.nome}
                          sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <MediaFallback variant="establishment" label={est.nome} />
                      )}
                    </Box>
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
                        Diárias a partir de {formatCurrency(minPrice)}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
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
      || est.fotos?.[0]?.url;

    // Extract unique room type names for display
    const roomTypesList = Array.from(
      new Set(est.quartos?.map((r: any) => r.tipoAcomodacao?.nome).filter(Boolean))
    ) as string[];

    return (
      <Card
        key={est.id}
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
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color 180ms, box-shadow 180ms, transform 180ms',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: (t) => `0 8px 24px ${alpha(t.palette.text.primary, 0.08)}`,
            transform: 'translateY(-2px)',
          },
        }}
      >
        {/* Cover Photo */}
        <Box sx={{ position: 'relative', height: 190, flexShrink: 0 }}>
          {coverPhoto ? (
            <CardMedia
              component="img"
              image={coverPhoto}
              alt={est.nome}
              sx={{ height: '100%', width: '100%', objectFit: 'cover' }}
            />
          ) : (
            <MediaFallback variant="establishment" label={est.nome} />
          )}
          <FavoriteButton estabelecimentoId={est.id} nome={est.nome} />
          {est.cidade?.nome && (
            <Chip
              label={est.cidade.nome}
              icon={<LocationOn sx={{ fontSize: 14 }} />}
              size="small"
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                bgcolor: (t) => alpha(t.palette.common.black, 0.66),
                color: 'common.white',
                '& .MuiChip-icon': { color: 'common.white' },
              }}
            />
          )}
        </Box>

        {/* Content details */}
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {est.nome}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
              <Star sx={{ fontSize: 16, color: 'warning.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {Number(est.notaMedia).toFixed(1)}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                ({est.totalAvaliacoes})
              </Typography>
            </Box>
          </Box>

          <Typography variant="caption" color="textSecondary">
            {roomTypesList.length > 0 ? roomTypesList.join(' • ') : 'Hospedagem'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {est.comodidades?.slice(0, 3).map((ea: any) => (
              <Chip
                key={ea.comodidade.id}
                icon={AMENITY_ICONS[ea.comodidade.nome] || <Home fontSize="small" />}
                label={ea.comodidade.nome}
                size="small"
                variant="outlined"
                sx={{ '& .MuiChip-icon': { color: 'primary.main' } }}
              />
            ))}
            {est.comodidades?.length > 3 && (
              <Chip label={`+${est.comodidades.length - 3}`} size="small" variant="outlined" />
            )}
          </Box>

          {/* Pricing & CTA */}
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
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                Diárias a partir de
              </Typography>
              {minPrice !== null ? (
                <Typography variant="h6" color="primary">
                  {formatCurrency(minPrice)}
                </Typography>
              ) : (
                <Typography variant="subtitle2" color="textSecondary">
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
            >
              Ver detalhes
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }
}
