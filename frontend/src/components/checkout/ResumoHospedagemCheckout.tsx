import { Box, Chip, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { FormSection, InfoGrid, InfoItem, StatusChip, toneBorder, toneColor, toneSurface } from '../common';
import { formatCurrency, formatDate, radius } from '../../theme/tokens';
import type { CheckoutDetalhePayload } from './contrato';

const noitesEntre = (checkIn: string, checkOut: string) =>
  dayjs(checkOut).diff(dayjs(checkIn), 'day');

/** O backend grava `CONFIRMADO`; o design system conhece `APROVADO`. */
const statusPagamento = (status: string) => (status === 'CONFIRMADO' ? 'APROVADO' : status);

/** Rótulos de pagamento do backend que o `statusMeta` não cobre com o mesmo nome. */
const ROTULO_PAGAMENTO: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  CONFIRMADO: 'Confirmado',
  ESTORNADO: 'Estornado',
  CANCELADO: 'Cancelado',
  EM_ANALISE: 'Em análise',
  PROCESSANDO: 'Processando',
};

/**
 * Resumo somente leitura da hospedagem no drawer de check-out:
 * dados da estadia, conferência financeira e situação da acomodação.
 *
 * Nada aqui altera valores: o check-out só encerra a hospedagem.
 */
export function ResumoHospedagemCheckout({ detalhe }: { detalhe: CheckoutDetalhePayload }) {
  const { reserva, checkin, financeiro, acomodacao } = detalhe;
  const noites = noitesEntre(reserva.checkIn, reserva.checkOut);
  const saldoEmAberto = Number(financeiro?.saldoEmAberto ?? 0);
  const temSaldo = saldoEmAberto > 0;
  const proximaEntrada = acomodacao?.proximaEntrada ?? null;

  const contato = reserva.hospede?.telefone || reserva.hospede?.email || 'Contato não informado';

  return (
    <>
      <FormSection
        title="Hospedagem"
        description="Confira os dados registrados antes de encerrar."
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
              label="Hóspede"
              value={
                <>
                  {reserva.hospede?.nome || 'Hóspede'}
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                    {contato}
                  </Typography>
                </>
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
              label="Ocupação prevista"
              value={`${reserva.adultos} ${reserva.adultos === 1 ? 'adulto' : 'adultos'}${
                reserva.criancas > 0
                  ? ` · ${reserva.criancas} ${reserva.criancas === 1 ? 'criança' : 'crianças'}`
                  : ''
              }`}
            />
            <InfoItem
              label="Check-in"
              value={
                checkin
                  ? `${formatDate(checkin.realizadoEm, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}${checkin.responsavel?.nome ? ` · ${checkin.responsavel.nome}` : ''}`
                  : 'Não registrado'
              }
            />
          </InfoGrid>
        </Box>
      </FormSection>

      <FormSection
        title="Pendências financeiras"
        description="Somente conferência: o check-out não cobra nem altera valores."
      >
        <Box
          sx={(t) => ({
            p: { xs: 2, sm: 2.5 },
            borderRadius: `${radius.lg}px`,
            border: '1px solid',
            borderColor: temSaldo ? toneBorder(t, 'warning') : 'divider',
            bgcolor: temSaldo ? toneSurface(t, 'warning') : 'transparent',
          })}
        >
          <InfoGrid columns={3}>
            <InfoItem label="Total" value={formatCurrency(financeiro?.valorTotal)} />
            <InfoItem label="Pago" value={formatCurrency(financeiro?.valorPago)} />
            <InfoItem
              label="Em aberto"
              emphasis
              value={
                <Box
                  component="span"
                  sx={(t) => ({
                    color: temSaldo ? toneColor(t, 'error') : toneColor(t, 'success'),
                  })}
                >
                  {formatCurrency(saldoEmAberto)}
                </Box>
              }
            />
          </InfoGrid>

          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}
            >
              Pagamento registrado
            </Typography>
            {financeiro?.pagamento ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {financeiro.pagamento.metodo}
                </Typography>
                <StatusChip
                  status={statusPagamento(financeiro.pagamento.status)}
                  label={
                    ROTULO_PAGAMENTO[financeiro.pagamento.status] || financeiro.pagamento.status
                  }
                />
                <Typography variant="body2" color="textSecondary">
                  {formatCurrency(financeiro.pagamento.valor)}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="textSecondary">
                Sem pagamento vinculado a esta reserva.
              </Typography>
            )}
          </Box>

          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1.5 }}>
            {temSaldo
              ? 'Há saldo em aberto. Combine o acerto com o hóspede — o check-out não bloqueia por isso.'
              : 'Sem saldo em aberto: a hospedagem está quitada.'}
          </Typography>
        </Box>
      </FormSection>

      <FormSection
        title="Acomodação"
        description="Situação do quarto para a próxima entrada."
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
            <InfoItem label="Acomodação" value={acomodacao?.nome || reserva.quarto?.nome || '—'} />
            <InfoItem
              label="Tipo"
              value={acomodacao?.tipoAcomodacao?.nome || 'Não informado'}
            />
            <InfoItem
              label="Capacidade"
              value={`${acomodacao?.capacidade ?? reserva.quarto?.capacidade ?? 0} ${
                (acomodacao?.capacidade ?? reserva.quarto?.capacidade ?? 0) === 1
                  ? 'hóspede'
                  : 'hóspedes'
              }`}
            />
            <InfoItem
              label="Próxima entrada"
              value={
                proximaEntrada ? (
                  <>
                    {formatDate(proximaEntrada.checkIn)}
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                      Reserva {proximaEntrada.codigoReserva}
                      {proximaEntrada.hospedeNome ? ` · ${proximaEntrada.hospedeNome}` : ''}
                    </Typography>
                  </>
                ) : (
                  'Nenhuma entrada prevista'
                )
              }
            />
          </InfoGrid>
        </Box>
      </FormSection>
    </>
  );
}
