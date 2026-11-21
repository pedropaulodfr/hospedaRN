import { Avatar, Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { HowToReg, KeyboardArrowRight, LockOutlined, Visibility } from '@mui/icons-material';
import dayjs from 'dayjs';
import { StatusChip } from '../common';
import { formatDate, radius } from '../../theme/tokens';
import type { CheckInListItem } from './contrato';

const noitesEntre = (checkIn: string, checkOut: string) => dayjs(checkOut).diff(dayjs(checkIn), 'day');

const ehRealizado = (item: CheckInListItem) =>
  item.situacaoCheckIn === 'REALIZADO' || Boolean(item.checkin);

/** "Chegada hoje" / "Em X dias" / "Atrasado há X dias". */
function rotuloChegada(diasParaChegada: number): string {
  if (!Number.isFinite(diasParaChegada)) return 'Data de chegada indisponível';
  if (diasParaChegada === 0) return 'Chegada hoje';
  if (diasParaChegada > 0) {
    return `Em ${diasParaChegada} ${diasParaChegada === 1 ? 'dia' : 'dias'}`;
  }
  const atraso = Math.abs(diasParaChegada);
  return `Atrasado há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`;
}

/**
 * Listagem de check-ins: tabela no desktop (md+) e cards empilhados no mobile.
 * Cada linha/card abre o drawer; o botão de ação é o alvo de teclado explícito.
 */
export function CheckinLista({
  itens,
  onAbrir,
}: {
  itens: CheckInListItem[];
  onAbrir: (reservaId: string) => void;
}) {
  const renderAcao = (item: CheckInListItem, larguraTotal: boolean) => {
    const comum = { minHeight: 44, width: larguraTotal ? '100%' : 'auto' };

    if (ehRealizado(item)) {
      return (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Visibility />}
          onClick={(evento) => {
            evento.stopPropagation();
            onAbrir(item.reserva.id);
          }}
          aria-label={`Ver check-in da reserva ${item.reserva.codigoReserva}`}
          sx={comum}
        >
          Ver check-in
        </Button>
      );
    }

    if (!item.elegivel) {
      const motivo = item.motivoInelegibilidade || 'Check-in indisponível para esta reserva.';
      return (
        <Tooltip title={motivo}>
          <span style={{ display: 'inline-flex', width: larguraTotal ? '100%' : 'auto' }}>
            <Button
              size="small"
              variant="outlined"
              disabled
              startIcon={<LockOutlined />}
              aria-label={`Check-in indisponível: ${motivo}`}
              sx={comum}
            >
              Indisponível
            </Button>
          </span>
        </Tooltip>
      );
    }

    return (
      <Button
        size="small"
        variant="contained"
        startIcon={<HowToReg />}
        onClick={(evento) => {
          evento.stopPropagation();
          onAbrir(item.reserva.id);
        }}
        aria-label={`Fazer check-in da reserva ${item.reserva.codigoReserva}`}
        sx={comum}
      >
        Fazer check-in
      </Button>
    );
  };

  /** Situação na tabela empilhada na vertical para economizar largura no desktop. */
  const situacaoTabela = (item: CheckInListItem) => (
    <Stack direction="column" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={item.situacaoCheckIn} />
      {ehRealizado(item) && item.checkInAntecipado && (
        <StatusChip status="EM_ANALISE" label="Antecipado" />
      )}
    </Stack>
  );

  const colunaSituacao = (item: CheckInListItem) => (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      <StatusChip status={item.situacaoCheckIn} />
      {ehRealizado(item) && item.checkInAntecipado && (
        <StatusChip status="EM_ANALISE" label="Antecipado" />
      )}
    </Stack>
  );

  /** Data + hora do check-in já realizado (o rótulo de atraso não se aplica). */
  const legendaPeriodo = (item: CheckInListItem): string => {
    const noites = noitesEntre(item.reserva.checkIn, item.reserva.checkOut);
    const noitesLabel = `${noites} ${noites === 1 ? 'noite' : 'noites'}`;

    if (ehRealizado(item)) {
      const realizadoEm = item.checkin?.realizadoEm;
      const quando = realizadoEm
        ? `Check-in realizado em ${formatDate(realizadoEm, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : 'Check-in realizado';
      return `${noitesLabel} · ${quando}`;
    }

    return `${noitesLabel} · ${rotuloChegada(item.diasParaChegada)}`;
  };

  const renderPeriodo = (item: CheckInListItem) => (
    <>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {formatDate(item.reserva.checkIn)} a {formatDate(item.reserva.checkOut)}
      </Typography>
      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
        {legendaPeriodo(item)}
      </Typography>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <TableContainer
        sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto', maxWidth: '100%' }}
      >
        <Table
          size="small"
          aria-label="Central de check-in"
          sx={{ '& .MuiTableCell-root': { px: 1.5 } }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Hóspede</TableCell>
              <TableCell>Reserva</TableCell>
              <TableCell>Acomodação</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right">Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {itens.map((item) => (
              <TableRow
                key={item.reserva.id}
                hover
                tabIndex={0}
                aria-label={`Abrir detalhes do check-in da reserva ${item.reserva.codigoReserva}`}
                onClick={() => onAbrir(item.reserva.id)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    onAbrir(item.reserva.id);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                }}
              >
                <TableCell sx={{ py: 1.25, maxWidth: 220 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar sx={{ width: 34, height: 34, fontSize: '0.8125rem', flexShrink: 0 }}>
                      {item.reserva.hospede?.nome?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {item.reserva.hospede?.nome || 'Hóspede'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        noWrap
                        sx={{ display: 'block' }}
                      >
                        {item.reserva.hospede?.telefone ||
                          item.reserva.hospede?.email ||
                          'Sem contato'}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {item.reserva.codigoReserva}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={item.reserva.status} />
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 1.25, maxWidth: 170 }}>
                  <Tooltip title={item.reserva.quarto?.nome || ''}>
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {item.reserva.quarto?.nome || '—'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>{renderPeriodo(item)}</TableCell>
                <TableCell sx={{ py: 1.25 }}>{situacaoTabela(item)}</TableCell>
                <TableCell
                  align="right"
                  sx={{ py: 1, whiteSpace: 'nowrap' }}
                  onClick={(evento) => evento.stopPropagation()}
                >
                  {renderAcao(item, false)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile / tablet estreito: cards empilhados, sem scroll horizontal */}
      <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' }, p: 2 }}>
        {itens.map((item) => (
          <Box
            key={item.reserva.id}
            onClick={() => onAbrir(item.reserva.id)}
            sx={{
              p: 2,
              borderRadius: `${radius.lg}px`,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              cursor: 'pointer',
              transition: 'border-color 120ms',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
              <Avatar sx={{ width: 40, height: 40, fontSize: '0.875rem', flexShrink: 0 }}>
                {item.reserva.hospede?.nome?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {item.reserva.hospede?.nome || 'Hóspede'}
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                  Reserva {item.reserva.codigoReserva}
                  {item.reserva.hospede?.telefone ? ` · ${item.reserva.hospede.telefone}` : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`Abrir detalhes do check-in da reserva ${item.reserva.codigoReserva}`}
                onClick={(evento) => {
                  evento.stopPropagation();
                  onAbrir(item.reserva.id);
                }}
                sx={{ minWidth: 44, minHeight: 44, ml: 0.5, flexShrink: 0 }}
              >
                <KeyboardArrowRight />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
              {colunaSituacao(item)}
              <StatusChip status={item.reserva.status} />
            </Box>

            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="textSecondary">
                {item.reserva.quarto?.nome || 'Acomodação a definir'}
              </Typography>
              {renderPeriodo(item)}
            </Stack>

            {renderAcao(item, true)}
          </Box>
        ))}
      </Stack>
    </>
  );
}
