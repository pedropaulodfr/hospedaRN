import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { FormSection, InfoGrid, InfoItem, toneColor, toneSurface } from '../common';
import { radius } from '../../theme/tokens';
import type { CheckinDetalhe } from './contrato';

/**
 * Modo leitura do check-in já realizado: data/hora, responsável, hóspedes
 * registrados (presentes/ausentes) e observações da recepção.
 */
export function CheckinRealizadoResumo({ checkin }: { checkin: CheckinDetalhe }) {
  const hospedes = checkin.hospedes ?? [];

  return (
    <FormSection title="Check-in realizado" description="Registro da recepção — somente leitura.">
      <Box sx={{ p: 2, borderRadius: `${radius.lg}px`, border: '1px solid', borderColor: 'divider' }}>
        <InfoGrid columns={2}>
          <InfoItem
            label="Realizado em"
            value={dayjs(checkin.realizadoEm).format('DD/MM/YYYY [às] HH:mm')}
          />
          <InfoItem label="Responsável" value={checkin.responsavel?.nome || 'Não registrado'} />
        </InfoGrid>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Pessoas registradas ({hospedes.length})
        </Typography>
        {hospedes.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Nenhum hóspede registrado neste check-in.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {hospedes.map((hospede) => (
              <Box
                key={hospede.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: `${radius.md}px`,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Avatar sx={{ width: 34, height: 34, fontSize: '0.8125rem' }}>
                  {hospede.nome?.charAt(0)?.toUpperCase() || '?'}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {hospede.nome}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {hospede.parentesco || (hospede.principal ? 'Hóspede principal' : 'Acompanhante')}
                    {hospede.cpf ? ` · CPF ${hospede.cpf}` : ''}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}
                >
                  <Chip
                    label={hospede.principal ? 'Principal' : 'Acompanhante'}
                    size="small"
                    sx={(t) =>
                      hospede.principal
                        ? {
                            bgcolor: toneSurface(t, 'primary'),
                            color: toneColor(t, 'primary'),
                            fontWeight: 700,
                          }
                        : {}
                    }
                  />
                  <Chip
                    label={hospede.presente ? 'Presente' : 'Ausente'}
                    size="small"
                    sx={(t) =>
                      hospede.presente
                        ? {
                            bgcolor: toneSurface(t, 'success'),
                            color: toneColor(t, 'success'),
                            fontWeight: 700,
                          }
                        : {
                            bgcolor: toneSurface(t, 'error'),
                            color: toneColor(t, 'error'),
                            fontWeight: 700,
                          }
                    }
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {checkin.observacoes && (
        <Box
          sx={{
            p: 2,
            borderRadius: `${radius.lg}px`,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography
            variant="caption"
            color="textSecondary"
            sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}
          >
            Observações do check-in
          </Typography>
          <Typography variant="body2">{checkin.observacoes}</Typography>
        </Box>
      )}
    </FormSection>
  );
}
