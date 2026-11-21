import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Close, InfoOutlined, LockOutlined, Logout, WarningAmber } from '@mui/icons-material';
import {
  ConfirmDialog,
  ErrorState,
  FormError,
  FormGrid,
  FormSection,
  FormSpan,
  InfoGrid,
  InfoItem,
  InlineLoading,
  toneBorder,
  toneColor,
  toneSurface,
} from '../common';
import { formatCurrency, formatDate, radius } from '../../theme/tokens';
import { checkoutsApi } from '../../services/api';
import { ResumoHospedagemCheckout } from './ResumoHospedagemCheckout';
import type { AvisoCheckout, CheckoutBody, CheckoutDetalhePayload } from './contrato';
import { MAX_OBSERVACOES } from './contrato';

/**
 * Mensagem amigável a partir do erro do axios. O `ValidationPipe` devolve
 * `message: string[]`; nesse caso juntamos as mensagens em uma frase.
 */
function mensagemDeErro(erro: unknown, fallback: string): string {
  const mensagem = (erro as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;

  if (Array.isArray(mensagem) && mensagem.every((item) => typeof item === 'string')) {
    const texto = mensagem.join(' ').trim();
    if (texto) return texto;
  }
  if (typeof mensagem === 'string' && mensagem.trim()) return mensagem;
  return fallback;
}

/** Saída antecipada é informativa; as demais pendências pedem atenção. */
const severidadeAviso = (aviso: AvisoCheckout): 'warning' | 'info' =>
  aviso.codigo === 'SAIDA_ANTECIPADA' ? 'info' : 'warning';

/**
 * Drawer de check-out: conferência da hospedagem e confirmação do encerramento.
 * Quando o check-out já existe, entra em modo leitura (quem encerrou, quando e
 * as observações). Só busca o detalhe quando aberto.
 */
export function CheckoutDrawer({
  open,
  reservaId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  reservaId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [detalhe, setDetalhe] = useState<CheckoutDetalhePayload | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarAberto, setConfirmarAberto] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [erroDataHora, setErroDataHora] = useState<string | null>(null);

  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    if (!reservaId) return;
    setCarregando(true);
    setErroCarga(null);
    try {
      const res = await checkoutsApi.getByReserva(reservaId);
      const payload: CheckoutDetalhePayload = res.data?.data ?? res.data;
      setDetalhe(payload ?? null);
    } catch (erro) {
      setErroCarga(
        mensagemDeErro(erro, 'Não foi possível carregar os dados do check-out. Tente novamente.'),
      );
    } finally {
      setCarregando(false);
    }
  }, [reservaId]);

  useEffect(() => {
    if (!open || !reservaId) return;
    setDetalhe(null);
    setErroCarga(null);
    setErroForm(null);
    setErroDataHora(null);
    setObservacoes('');
    // Em branco = horário do servidor (evita registrar minutos defasados).
    setDataHora('');
    carregar();
  }, [open, reservaId, carregar]);

  // Foco inicial no título do painel (leitura por leitor de tela).
  useEffect(() => {
    if (!open || carregando) return;
    const timer = window.setTimeout(() => tituloRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open, carregando]);

  const fechar = () => {
    if (salvando) return;
    onClose();
  };

  const modoLeitura = Boolean(detalhe?.checkout);
  const avisos = detalhe?.avisos ?? [];
  const reserva = detalhe?.reserva;
  const hospedes = detalhe?.checkin?.hospedes ?? [];
  const checkout = detalhe?.checkout ?? null;

  const abrirConfirmacao = () => {
    if (!detalhe || !reserva || modoLeitura) return;
    setErroForm(null);

    if (dataHora) {
      const data = new Date(dataHora);
      if (Number.isNaN(data.getTime())) {
        setErroDataHora('Informe uma data e hora válidas ou deixe o campo em branco.');
        window.setTimeout(() => document.getElementById('checkout-dataHora')?.focus(), 0);
        return;
      }
    }

    setErroDataHora(null);
    setConfirmarAberto(true);
  };

  const enviar = async () => {
    if (!reservaId) return;
    const corpo: CheckoutBody = { reservaId };

    // Campo em branco → o backend usa o horário do servidor.
    if (dataHora) corpo.realizadoEm = new Date(dataHora).toISOString();
    if (observacoes.trim()) corpo.observacoes = observacoes.trim();

    try {
      setSalvando(true);
      setErroForm(null);
      await checkoutsApi.create(corpo);
      setConfirmarAberto(false);
      onSuccess();
    } catch (erro) {
      setConfirmarAberto(false);
      setErroForm(
        mensagemDeErro(
          erro,
          'Não foi possível realizar o check-out agora. Verifique os dados e tente novamente.',
        ),
      );
      // O alerta de erro fica no topo do conteúdo: garante que ele esteja visível.
      conteudoRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  };

  const avisoSaida = avisos.find(
    (aviso) => aviso.codigo === 'SAIDA_ANTECIPADA' || aviso.codigo === 'SAIDA_APOS_PREVISTO',
  );

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={fechar}
        aria-labelledby="checkout-drawer-titulo"
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 600 },
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {/* Cabeçalho fixo */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 40,
                height: 40,
                borderRadius: `${radius.md}px`,
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                bgcolor: 'action.selected',
                color: 'primary.main',
                '& svg': { fontSize: 22 },
              }}
            >
              <Logout />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                id="checkout-drawer-titulo"
                variant="h6"
                component="h2"
                tabIndex={-1}
                ref={tituloRef}
                sx={{ outline: 'none', fontWeight: 700 }}
              >
                {modoLeitura ? 'Check-out realizado' : 'Realizar check-out'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ wordBreak: 'break-word' }}>
                {reserva
                  ? `Reserva ${reserva.codigoReserva} · ${reserva.hospede?.nome || 'Hóspede'}`
                  : 'Carregando dados da reserva…'}
              </Typography>
            </Box>
            <IconButton
              onClick={fechar}
              aria-label="Fechar painel de check-out"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Close />
            </IconButton>
          </Box>

          {/* Conteúdo rolável */}
          <Box
            ref={conteudoRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: { xs: 2, sm: 3 },
              py: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {carregando ? (
              <Box sx={{ py: 6 }}>
                <InlineLoading label="Carregando conferência do check-out…" />
              </Box>
            ) : erroCarga ? (
              <ErrorState
                compact
                title="Não foi possível carregar o check-out"
                description={erroCarga}
                onRetry={carregar}
              />
            ) : detalhe ? (
              <>
                <FormError message={erroForm} />

                {!detalhe.elegivel && detalhe.motivoInelegibilidade && (
                  <Alert severity="error" icon={<LockOutlined />} role="alert">
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Check-out indisponível
                    </Typography>
                    <Typography variant="body2">{detalhe.motivoInelegibilidade}</Typography>
                  </Alert>
                )}

                {avisos.map((aviso, indice) => {
                  const severidade = severidadeAviso(aviso);
                  return (
                    <Alert
                      key={`${aviso.codigo}-${indice}`}
                      severity={severidade}
                      icon={severidade === 'info' ? <InfoOutlined /> : <WarningAmber />}
                    >
                      {aviso.mensagem}
                    </Alert>
                  );
                })}

                <ResumoHospedagemCheckout detalhe={detalhe} />

                {detalhe.checkin && (
                  <FormSection
                    title="Hóspedes do check-in"
                    description="Somente leitura — quem foi registrado na entrada."
                  >
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
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ display: 'block' }}
                              >
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
                  </FormSection>
                )}

                {modoLeitura && checkout ? (
                  <FormSection
                    title="Check-out realizado"
                    description="Registro da recepção — somente leitura."
                  >
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: `${radius.lg}px`,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <InfoGrid columns={2}>
                        <InfoItem
                          label="Encerrado em"
                          value={formatDate(checkout.realizadoEm, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        />
                        <InfoItem
                          label="Responsável"
                          value={checkout.responsavel?.nome || 'Não registrado'}
                        />
                      </InfoGrid>
                    </Box>

                    {checkout.observacoes && (
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
                          Observações do check-out
                        </Typography>
                        <Typography variant="body2">{checkout.observacoes}</Typography>
                      </Box>
                    )}
                  </FormSection>
                ) : (
                  <FormSection
                    title="Registro do check-out"
                    description="Confira as pendências e registre o encerramento."
                  >
                    <FormGrid columns={2} gap={2}>
                      <FormSpan span={2}>
                        <TextField
                          id="checkout-observacoes"
                          label="Observações"
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value.slice(0, MAX_OBSERVACOES))}
                          multiline
                          minRows={3}
                          helperText={`${observacoes.length}/${MAX_OBSERVACOES} caracteres`}
                          slotProps={{
                            htmlInput: {
                              maxLength: MAX_OBSERVACOES,
                              'aria-label': 'Observações do check-out',
                            },
                          }}
                        />
                      </FormSpan>
                      <FormSpan span={2}>
                        <TextField
                          id="checkout-dataHora"
                          type="datetime-local"
                          label="Data e hora do check-out"
                          value={dataHora}
                          onChange={(e) => {
                            setDataHora(e.target.value);
                            setErroDataHora(null);
                          }}
                          error={Boolean(erroDataHora)}
                          helperText={erroDataHora ?? 'Deixe em branco para registrar o horário atual'}
                          slotProps={{ inputLabel: { shrink: true } }}
                          sx={(t) => ({ '& input': { colorScheme: t.palette.mode } })}
                        />
                      </FormSpan>
                    </FormGrid>
                  </FormSection>
                )}

                {salvando && <InlineLoading label="Registrando check-out…" />}
              </>
            ) : null}
          </Box>

          {/* Rodapé fixo */}
          {detalhe && !carregando && !erroCarga && (
            <Box
              sx={{
                flexShrink: 0,
                px: { xs: 2, sm: 3 },
                py: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                gap: 1,
                flexDirection: { xs: 'column-reverse', sm: 'row' },
                justifyContent: 'flex-end',
              }}
            >
              {modoLeitura ? (
                <Button
                  variant="contained"
                  onClick={fechar}
                  sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
                >
                  Fechar
                </Button>
              ) : (
                <>
                  <Button
                    color="inherit"
                    onClick={fechar}
                    disabled={salvando}
                    sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancelar
                  </Button>
                  <Tooltip
                    title={
                      !detalhe.elegivel
                        ? detalhe.motivoInelegibilidade || 'Check-out indisponível'
                        : ''
                    }
                  >
                    <span style={{ display: 'inline-flex', width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={
                          salvando ? <CircularProgress size={16} color="inherit" /> : <Logout />
                        }
                        onClick={abrirConfirmacao}
                        disabled={salvando || !detalhe.elegivel}
                        aria-busy={salvando}
                        sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
                      >
                        {salvando ? 'Encerrando…' : 'Confirmar check-out'}
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
            </Box>
          )}
        </Box>
      </Drawer>

      <ConfirmDialog
        open={confirmarAberto}
        title="Confirmar check-out"
        confirmLabel="Confirmar check-out"
        cancelLabel="Voltar"
        loading={salvando}
        onConfirm={enviar}
        onClose={() => {
          if (!salvando) setConfirmarAberto(false);
        }}
        description={
          <>
            A hospedagem da reserva <strong>{reserva?.codigoReserva}</strong> de{' '}
            <strong>{reserva?.hospede?.nome || 'hóspede'}</strong> será encerrada. Esta ação não
            pode ser desfeita pela recepção.
          </>
        }
      >
        {reserva && (
          <Box sx={{ mt: 2 }}>
            <InfoGrid columns={2}>
              <InfoItem label="Acomodação" value={reserva.quarto?.nome || '—'} />
              <InfoItem
                label="Período"
                value={`${formatDate(reserva.checkIn)} a ${formatDate(reserva.checkOut)}`}
              />
              <InfoItem
                label="Registro"
                value={dataHora ? 'Data e hora informadas' : 'Horário atual do servidor'}
              />
              <InfoItem
                label="Saldo em aberto"
                value={formatCurrency(detalhe?.financeiro?.saldoEmAberto)}
                emphasis
              />
            </InfoGrid>

            {avisoSaida && (
              <Box
                sx={(t) => ({
                  mt: 2,
                  p: 1.5,
                  borderRadius: `${radius.md}px`,
                  border: '1px solid',
                  borderColor: toneBorder(t, 'warning'),
                  bgcolor: toneSurface(t, 'warning'),
                })}
              >
                <Typography
                  variant="caption"
                  sx={(t) => ({ display: 'block', fontWeight: 700, color: toneColor(t, 'warning') })}
                >
                  Atenção
                </Typography>
                <Typography variant="body2">{avisoSaida.mensagem}</Typography>
              </Box>
            )}
          </Box>
        )}
      </ConfirmDialog>
    </>
  );
}
