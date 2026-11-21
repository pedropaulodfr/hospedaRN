import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close, OpenInNew } from '@mui/icons-material';
import { formatDate } from '../../theme/tokens';

export interface EventCity {
  cidade: { id: string; nome: string };
}

export interface EventPhoto {
  id: string;
  url: string;
  isCapa: boolean;
  ordem: number;
}

export interface EventData {
  id: string;
  nome: string;
  descricao?: string;
  linkOficial?: string;
  dataInicio: string;
  dataFim: string;
  ativo?: boolean;
  eventosCidades?: EventCity[];
  fotos?: EventPhoto[];
}

/** Foto de capa do evento: a marcada como capa ou, na falta dela, a primeira. */
export function eventCover(event: EventData): EventPhoto | null {
  const fotos = event.fotos ?? [];
  return fotos.find((foto) => foto.isCapa) ?? fotos[0] ?? null;
}

/** Galeria ordenada por `ordem`, mantendo a capa como primeira imagem. */
export function eventGallery(event: EventData): EventPhoto[] {
  const fotos = [...(event.fotos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const capa = fotos.find((foto) => foto.isCapa);
  if (!capa) return fotos;
  return [capa, ...fotos.filter((foto) => foto.id !== capa.id)];
}

/**
 * Datas de evento são `@db.Date` (meia-noite UTC): formata em UTC para não
 * voltar um dia no fuso local.
 */
const DATA_EVENTO: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
};

/** Período legível: "12/03/2026" ou "12/03/2026 a 15/03/2026". */
export function formatEventPeriod(start?: string, end?: string) {
  const startLabel = formatDate(start, DATA_EVENTO);
  const endLabel = formatDate(end, DATA_EVENTO);
  if (startLabel === '—') return 'Data a confirmar';
  if (endLabel === '—' || startLabel === endLabel) return startLabel;
  return `${startLabel} a ${endLabel}`;
}

/** Dia e mês abreviado para o bloco de data dos cards. */
export function eventDateParts(value?: string) {
  const day = formatDate(value, { day: '2-digit', timeZone: 'UTC' }).replace(/^0/, '');
  const month = formatDate(value, { month: 'short', timeZone: 'UTC' })
    .replace('.', '')
    .toUpperCase();
  return {
    day,
    month: month === '—' ? '' : month,
  };
}

/**
 * Diálogo de detalhes do evento (fotos + informações).
 *
 * Compartilhado entre a agenda (`/eventos`) e a seção "Eventos próximos" da home,
 * para que o comportamento e o layout sejam idênticos nos dois lugares.
 */
export function EventDetailsDialog({
  event,
  onClose,
}: {
  event: EventData | null;
  onClose: () => void;
}) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Sempre que abre outro evento, volta para a primeira foto.
  useEffect(() => {
    if (event?.id) setActivePhotoIndex(0);
  }, [event?.id]);

  const gallery = event ? eventGallery(event) : [];
  const activePhoto =
    gallery.length > 0 ? gallery[Math.min(activePhotoIndex, gallery.length - 1)] : null;

  return (
    <Dialog
      open={Boolean(event)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="event-detail-title"
    >
      {event && (
        <>
          <DialogTitle
            id="event-detail-title"
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pr: 1 }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                {event.nome}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {formatEventPeriod(event.dataInicio, event.dataFim)}
                {gallery.length > 0 &&
                  ` · ${gallery.length} ${gallery.length === 1 ? 'foto' : 'fotos'}`}
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Fechar detalhes do evento">
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {activePhoto && (
              <Box>
                <Box
                  component="img"
                  src={activePhoto.url}
                  alt={`Foto ${gallery.findIndex((f) => f.id === activePhoto.id) + 1} de ${
                    gallery.length
                  } do evento ${event.nome}`}
                  sx={{
                    display: 'block',
                    width: '100%',
                    // `contain`: a foto aparece inteira (fotos verticais eram cortadas no `cover`).
                    height: { xs: 280, sm: 420 },
                    objectFit: 'contain',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                />

                {gallery.length > 1 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5 }}>
                    {gallery.map((foto, index) => {
                      const ativa = activePhoto.id === foto.id;
                      return (
                        <Box
                          key={foto.id}
                          component="button"
                          type="button"
                          onClick={() => setActivePhotoIndex(index)}
                          aria-label={`Ver foto ${index + 1} de ${gallery.length} do evento`}
                          aria-pressed={ativa}
                          sx={{
                            p: 0,
                            flexShrink: 0,
                            lineHeight: 0,
                            cursor: 'pointer',
                            bgcolor: 'transparent',
                            border: '2px solid',
                            borderColor: ativa ? 'primary.main' : 'transparent',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            component="img"
                            src={foto.url}
                            alt={`Miniatura da foto ${index + 1} do evento ${event.nome}`}
                            loading="lazy"
                            sx={{
                              display: 'block',
                              width: 80,
                              height: 60,
                              objectFit: 'contain',
                              bgcolor: 'action.hover',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            )}

            {event.descricao && (
              <Typography variant="body2" sx={{ mt: activePhoto ? 2.5 : 0, whiteSpace: 'pre-line' }}>
                {event.descricao}
              </Typography>
            )}

            <Box
              component="dl"
              sx={{
                m: 0,
                mt: 2.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
                gap: 1,
                columnGap: 2,
                alignItems: 'baseline',
              }}
            >
              <Typography component="dt" variant="body2" color="textSecondary">
                Período
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {formatEventPeriod(event.dataInicio, event.dataFim)}
              </Typography>

              <Typography component="dt" variant="body2" color="textSecondary">
                Cidades
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {event.eventosCidades?.length
                  ? event.eventosCidades.map((ec) => ec.cidade.nome).join(', ')
                  : 'Todo o estado'}
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            {event.linkOficial && (
              <Button
                component="a"
                href={event.linkOficial}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                sx={{ mr: 'auto' }}
              >
                Site oficial
              </Button>
            )}
            <Button onClick={onClose}>Fechar</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
