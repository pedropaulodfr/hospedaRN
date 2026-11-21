import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import {
  CalendarMonth,
  EventBusy,
  OpenInNew,
  PhotoLibraryOutlined,
  Place,
  TravelExplore,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../services/api';
import {
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  SectionHeading,
  CardGridSkeleton,
} from '../../components/common';
import {
  EventDetailsDialog,
  eventCover,
  eventDateParts,
  formatEventPeriod,
  type EventData,
} from '../../components/events/EventDetailsDialog';

export default function EventsPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['events-public'],
    queryFn: () => eventsApi.getAll(true),
    select: (res) => res.data?.data as EventData[] | undefined,
  });

  const events = data ?? [];

  // Diálogo de detalhe do evento (fotos + informações) — componente compartilhado
  // com a seção "Eventos próximos" da home.
  const [detailEvent, setDetailEvent] = useState<EventData | null>(null);

  const openDetail = (event: EventData) => setDetailEvent(event);
  const closeDetail = () => setDetailEvent(null);

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        icon={<CalendarMonth />}
        overline="Agenda cultural"
        title="Eventos no Rio Grande do Norte"
        subtitle="Festas, festivais e encontros que movem o calendário potiguar. Escolha o evento e encontre onde ficar."
        actions={
          <Button
            variant="outlined"
            startIcon={<TravelExplore />}
            onClick={() => navigate('/busca')}
          >
            Buscar hospedagens
          </Button>
        }
      />

      <SectionHeading
        title="Próximos eventos"
        subtitle={
          isLoading
            ? 'Carregando a agenda…'
            : `${events.length} ${events.length === 1 ? 'evento na agenda' : 'eventos na agenda'}`
        }
      />

      {isLoading ? (
        <CardGridSkeleton count={6} height={280} />
      ) : isError ? (
        <ErrorState
          title="Não foi possível carregar a agenda"
          description="Ocorreu uma falha ao buscar os eventos. Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<EventBusy />}
          title="Nenhum evento programado"
          description="Ainda não há eventos futuros cadastrados. Enquanto isso, explore os destinos do estado."
          action={
            <Button variant="contained" onClick={() => navigate('/busca')}>
              Explorar hospedagens
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
              md: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {events.map((event) => {
            const { day, month } = eventDateParts(event.dataInicio);
            const cities = event.eventosCidades ?? [];
            const cover = eventCover(event);
            const totalFotos = event.fotos?.length ?? 0;

            return (
              <Card
                key={event.id}
                role="button"
                tabIndex={0}
                aria-label={`Ver detalhes e fotos do evento ${event.nome}`}
                onClick={() => openDetail(event)}
                onKeyDown={(e) => {
                  // Só abre o detalhe quando o próprio card está focado (não nos chips/botões internos).
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(event);
                  }
                }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'border-color 180ms, box-shadow 180ms',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: (t) => `0 6px 20px ${t.palette.action.focus}`,
                  },
                }}
              >
                {cover && (
                  <Box sx={{ position: 'relative', height: 160, flexShrink: 0 }}>
                    <Box
                      component="img"
                      src={cover.url}
                      alt={`Foto de capa do evento ${event.nome}`}
                      loading="lazy"
                      sx={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {totalFotos > 1 && (
                      <Chip
                        icon={<PhotoLibraryOutlined sx={{ fontSize: 14 }} />}
                        label={`${totalFotos} fotos`}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          bgcolor: 'common.black',
                          color: 'common.white',
                          '& .MuiChip-icon': { color: 'common.white' },
                        }}
                      />
                    )}
                  </Box>
                )}

                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {!cover && (
                      <Box
                        aria-hidden
                        sx={{
                          width: 56,
                          height: 64,
                          flexShrink: 0,
                          borderRadius: 3,
                          bgcolor: 'action.selected',
                          color: 'primary.main',
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
                        {event.nome}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatEventPeriod(event.dataInicio, event.dataFim)}
                      </Typography>
                    </Box>
                  </Box>

                  {event.descricao && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {event.descricao}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 'auto' }}>
                    {cities.length === 0 ? (
                      <Chip label="Todo o estado" size="small" variant="outlined" />
                    ) : (
                      cities.map(({ cidade }) => (
                        <Chip
                          key={cidade.id}
                          icon={<Place sx={{ fontSize: 14 }} />}
                          label={cidade.nome}
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/busca?cityId=${cidade.id}`);
                          }}
                          sx={{
                            '&:hover': {
                              borderColor: 'primary.main',
                              color: 'primary.main',
                            },
                          }}
                        />
                      ))
                    )}
                  </Box>
                </CardContent>

                <Divider />
                <Box
                  sx={{
                    px: 3,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    minHeight: 56,
                  }}
                >
                  <Button
                    size="small"
                    startIcon={<PhotoLibraryOutlined sx={{ fontSize: 16 }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(event);
                    }}
                  >
                    {totalFotos > 0 ? 'Ver fotos' : 'Ver detalhes'}
                  </Button>

                  {event.linkOficial && (
                    <Button
                      component="a"
                      href={event.linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Site oficial
                    </Button>
                  )}
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Diálogo de detalhe do evento (componente compartilhado com a home) */}
      <EventDetailsDialog event={detailEvent} onClose={closeDetail} />
    </PageContainer>
  );
}
