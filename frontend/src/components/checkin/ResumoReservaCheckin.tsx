import { Box, Chip, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { FormSection, InfoGrid, InfoItem, StatusChip } from '../common';
import { formatCurrency, formatDate, radius } from '../../theme/tokens';
import type { ReservaDetalhe } from './contrato';

/** Rótulos de status de pagamento (backend usa CONFIRMADO; design system, APROVADO). */
const ROTULO_PAGAMENTO: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  ESTORNADO: 'Estornado',
  CANCELADO: 'Cancelado',
  EM_ANALISE: 'Em análise',
  PROCESSANDO: 'Processando',
};

const statusPagamento = (status: string) => (status === 'CONFIRMADO' ? 'APROVADO' : status);

const noitesEntre = (checkIn: string, checkOut: string) =>
  dayjs(checkOut).diff(dayjs(checkIn), 'day');

/** Resumo da reserva exibido no topo do drawer de check-in. */
export function ResumoReservaCheckin({
  reserva,
  modoLeitura,
}: {
  reserva: ReservaDetalhe;
  modoLeitura: boolean;
}) {
  const noites = noitesEntre(reserva.checkIn, reserva.checkOut);

  return (
    <FormSection
      title="Resumo da reserva"
      description={modoLeitura ? 'Dados registrados no momento do check-in.' : 'Confira antes de confirmar.'}
    >
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: `${radius.lg}px`,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <InfoGrid columns={2}>
          <InfoItem
            label="Reserva"
            value={
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
              >
                <Chip
                  label={reserva.codigoReserva}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600, borderColor: 'divider' }}
                />
                <StatusChip status={reserva.status} />
              </Stack>
            }
          />
          <InfoItem
            label="Acomodação"
            value={
              reserva.quarto?.tipoAcomodacao?.nome
                ? `${reserva.quarto.nome} · ${reserva.quarto.tipoAcomodacao.nome}`
                : reserva.quarto?.nome || '—'
            }
          />
          <InfoItem
            label="Período"
            value={`${formatDate(reserva.checkIn)} a ${formatDate(reserva.checkOut)} · ${noites} ${
              noites === 1 ? 'noite' : 'noites'
            }`}
          />
          <InfoItem
            label="Hóspedes previstos"
            value={`${reserva.adultos} ${reserva.adultos === 1 ? 'adulto' : 'adultos'}${
              reserva.criancas > 0
                ? ` · ${reserva.criancas} ${reserva.criancas === 1 ? 'criança' : 'crianças'}`
                : ''
            }`}
          />
          <InfoItem label="Valor total" value={formatCurrency(reserva.valorTotal)} emphasis />
          <InfoItem
            label="Pagamento"
            value={
              reserva.pagamento ? (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
                >
                  <Typography variant="body2">{reserva.pagamento.metodo}</Typography>
                  <StatusChip
                    status={statusPagamento(reserva.pagamento.status)}
                    label={ROTULO_PAGAMENTO[reserva.pagamento.status] || reserva.pagamento.status}
                  />
                </Stack>
              ) : (
                'Sem pagamento vinculado'
              )
            }
          />
        </InfoGrid>
      </Box>
    </FormSection>
  );
}
