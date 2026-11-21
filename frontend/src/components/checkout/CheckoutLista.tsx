import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { KeyboardArrowRight, LockOutlined, Logout, Visibility } from '@mui/icons-material';
import dayjs from 'dayjs';
import { StatusChip, toneBorder, toneColor, toneSurface } from '../common';
import { formatDate, radius } from '../../theme/tokens';
import type { CheckoutListItem } from './contrato';

const noitesEntre = (checkIn: string, checkOut: string) => dayjs(checkOut).diff(dayjs(checkIn), 'day');

const ehRealizado = (item: CheckoutListItem) =>
  item.situacaoCheckout === 'REALIZADO' || Boolean(item.checkout);

/** "Saída hoje" / "Saída em X dias" / "Atrasado há X dias". */
function rotuloSaida(diasAposSaidaPrevista: number): string {
  if (!Number.isFinite(diasAposSaidaPrevista)) return 'Data de saída indisponível';
  if (diasAposSaidaPrevista === 0) return 'Saída hoje';
  if (diasAposSaidaPrevista < 0) {
    const restantes = Math.abs(diasAposSaidaPrevista);
    return `Saída em ${restantes} ${restantes === 1 ? 'dia' : 'dias'}`;
  }
  return `Atrasado há ${diasAposSaidaPrevista} ${diasAposSaidaPrevista === 1 ? 'dia' : 'dias'}`;
}

/** Aviso de saída antes da data prevista (informativo, nunca bloqueia). */
function ChipSaidaAntecipada() {
  return (
    <Chip
      size="small"
      label="Saída antecipada"
      sx={(t) => ({
        bgcolor: toneSurface(t, 'warning'),
        color: toneColor(t, 'warning'),
        border: '1px solid',
        borderColor: toneBorder(t, 'warning'),
        fontWeight: 600,
      })}
    />
  );
}

/**
 * Listagem de check-outs: tabela no desktop (md+) e cards empilhados no mobile.
 * Cada linha/card abre o drawer; o botão de ação é o alvo de teclado explícito.
 */
export function CheckoutLista({
  itens,
  onAbrir,
}: {
  itens: CheckoutListItem[];
  onAbrir: (reservaId: string) => void;
}) {
  const renderAcao = (item: CheckoutListItem, larguraTotal: boolean) => {
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
          aria-label={`Ver check-out da reserva ${item.reserva.codigoReserva}`}
          sx={comum}
        >
          Ver check-out
        </Button>
      );
    }

    if (!item.elegivel) {
      const motivo = item.motivoInelegibilidade || 'Check-out indisponível para esta reserva.';
      return (
        <Tooltip title={motivo}>
          <span style={{ display: 'inline-flex', width: larguraTotal ? '100%' : 'auto' }}>
            <Button
              size="small"
              variant="outlined"
              disabled
              startIcon={<LockOutlined />}
              aria-label={`Check-out indisponível: ${motivo}`}
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
        startIcon={<Logout />}
        onClick={(evento) => {
          evento.stopPropagation();
          onAbrir(item.reserva.id);
        }}
        aria-label={`Fazer check-out da reserva ${item.reserva.codigoReserva}`}
        sx={comum}
      >
        Fazer check-out
      </Button>
    );
  };

  /** Situação na tabela empilhada na vertical para economizar largura. */
  const situacaoTabela = (item: CheckoutListItem) => (
    <Stack direction="column" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={item.situacaoCheckout} />
      {item.saidaAntecipada && <ChipSaidaAntecipada />}
    </Stack>
  );

  /** Situação + status comercial da reserva lado a lado (mobile). */
  const situacaoLinha = (item: CheckoutListItem) => (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      <StatusChip status={item.situacaoCheckout} />
      <StatusChip status={item.reserva.status} />
      {item.saidaAntecipada && <ChipSaidaAntecipada />}
    </Stack>
  );

  /** Data + hora do check-out já realizado, ou o rótulo de prazo de saída. */
  const legendaPeriodo = (item: CheckoutListItem): string => {
    const noites = noitesEntre(item.reserva.checkIn, item.reserva.checkOut);
    const noitesLabel = `${noites} ${noites === 1 ? 'noite' : 'noites'}`;

    if (ehRealizado(item)) {
      const realizadoEm = item.checkout?.realizadoEm;
      const quando = realizadoEm
        ? `Check-out em ${formatDate(realizadoEm, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : 'Check-out realizado';
      return `${noitesLabel} · ${quando}`;
    }

    return `${noitesLabel} · ${rotuloSaida(item.diasAposSaidaPrevista)}`;
  };

  const renderPeriodo = (item: CheckoutListItem) => (
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
          aria-label="Central de check-out"
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
                aria-label={`Abrir detalhes do check-out da reserva ${item.reserva.codigoReserva}`}
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
                aria-label={`Abrir detalhes do check-out da reserva ${item.reserva.codigoReserva}`}
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
              {situacaoLinha(item)}
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
