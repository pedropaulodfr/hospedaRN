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
import { Close, HowToReg, InfoOutlined, LockOutlined, WarningAmber } from '@mui/icons-material';
import dayjs from 'dayjs';
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
  toneColor,
  toneSurface,
} from '../common';
import { formatDate, radius } from '../../theme/tokens';
import { checkinsApi } from '../../services/api';
import { AcompanhantesEditor } from './AcompanhantesEditor';
import { CheckinRealizadoResumo } from './CheckinRealizadoResumo';
import { ResumoReservaCheckin } from './ResumoReservaCheckin';
import type {
  AcompanhanteForm,
  AvisoCheckIn,
  CheckinDetalhePayload,
  HospedePrincipalForm,
} from './contrato';
import { MAX_ACOMPANHANTES, MAX_OBSERVACOES } from './contrato';

type Erros = Record<string, string>;

const apenasDigitos = (valor: string) => valor.replace(/\D/g, '');

/** Aceita somente data real (sem "2024-02-31"), não futura e com ano plausível. */
function dataNascimentoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return false;
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return data.getTime() <= hoje.getTime() && ano >= 1900;
}

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

const noitesEntre = (checkIn: string, checkOut: string) => dayjs(checkOut).diff(dayjs(checkIn), 'day');

const severidadeAviso = (aviso: AvisoCheckIn): 'warning' | 'info' =>
  aviso.codigo === 'CADASTRO_INCOMPLETO' ? 'info' : 'warning';

function textoAviso(aviso: AvisoCheckIn): string {
  if (aviso.codigo === 'CADASTRO_INCOMPLETO') {
    return `${aviso.mensagem} Preencha os dados do hóspede principal abaixo para completar o cadastro.`;
  }
  return aviso.mensagem;
}

/**
 * Drawer de check-in: pré-check-in (formulário) e modo leitura quando o
 * check-in já foi realizado. Só busca o detalhe quando aberto.
 */
export function CheckInDrawer({
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
  const [detalhe, setDetalhe] = useState<CheckinDetalhePayload | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarAberto, setConfirmarAberto] = useState(false);

  const [principal, setPrincipal] = useState<HospedePrincipalForm>({
    cpf: '',
    documento: '',
    dataNascimento: '',
    nacionalidade: '',
    telefone: '',
  });
  const [acompanhantes, setAcompanhantes] = useState<AcompanhanteForm[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<Erros>({});

  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    if (!reservaId) return;
    setCarregando(true);
    setErroCarga(null);
    try {
      const res = await checkinsApi.getByReserva(reservaId);
      const payload: CheckinDetalhePayload = res.data?.data ?? res.data;
      setDetalhe(payload ?? null);
    } catch (erro) {
      setErroCarga(
        mensagemDeErro(erro, 'Não foi possível carregar os dados do check-in. Tente novamente.'),
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
    setErros({});
    setAcompanhantes([]);
    setObservacoes('');
    setPrincipal({ cpf: '', documento: '', dataNascimento: '', nacionalidade: '', telefone: '' });
    carregar();
  }, [open, reservaId, carregar]);

  // Pré-preenche o complemento de cadastro com o perfil do hóspede.
  useEffect(() => {
    if (!detalhe) return;
    const perfil = detalhe.reserva.hospede?.hospedePerfil ?? null;
    setPrincipal({
      cpf: perfil?.cpf ?? '',
      documento: perfil?.rg ?? '',
      dataNascimento: (perfil?.dataNascimento ?? '').slice(0, 10),
      nacionalidade: perfil?.nacionalidade ?? '',
      telefone: detalhe.reserva.hospede?.telefone ?? '',
    });
  }, [detalhe]);

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

  const modoLeitura = Boolean(detalhe?.checkin);
  const avisos = detalhe?.avisos ?? [];
  const reserva = detalhe?.reserva;

  const totalPresentes =
    1 + acompanhantes.filter((acompanhante) => acompanhante.presente).length;

  /** Remove o erro de um campo assim que o usuário começa a corrigi-lo. */
  const limparErro = (chave: string) => {
    setErros((atual) => {
      if (!atual[chave]) return atual;
      const proximos = { ...atual };
      delete proximos[chave];
      return proximos;
    });
  };

  /** Validação local antes do POST. Retorna erros por campo e o foco do primeiro erro. */
  const validar = (): { erros: Erros; primeiroId: string | null } => {
    const novosErros: Erros = {};
    let primeiroId: string | null = null;
    const registrar = (chave: string, id: string, mensagem: string) => {
      novosErros[chave] = mensagem;
      if (!primeiroId) primeiroId = id;
    };

    if (principal.cpf.trim() && apenasDigitos(principal.cpf).length !== 11) {
      registrar('principal.cpf', 'checkin-principal-cpf', 'CPF deve ter 11 dígitos.');
    }
    if (principal.dataNascimento && !dataNascimentoValida(principal.dataNascimento)) {
      registrar(
        'principal.dataNascimento',
        'checkin-principal-dataNascimento',
        'Informe uma data de nascimento válida (não futura).',
      );
    }

    acompanhantes.forEach((acompanhante, indice) => {
      if (!acompanhante.nome.trim()) {
        registrar(
          `acompanhantes.${indice}.nome`,
          `acompanhante-${indice}-nome`,
          'Informe o nome do acompanhante.',
        );
      }
      if (acompanhante.cpf.trim() && apenasDigitos(acompanhante.cpf).length !== 11) {
        registrar(
          `acompanhantes.${indice}.cpf`,
          `acompanhante-${indice}-cpf`,
          'CPF deve ter 11 dígitos.',
        );
      }
      if (acompanhante.dataNascimento && !dataNascimentoValida(acompanhante.dataNascimento)) {
        registrar(
          `acompanhantes.${indice}.dataNascimento`,
          `acompanhante-${indice}-dataNascimento`,
          'Informe uma data de nascimento válida (não futura).',
        );
      }
    });

    if (observacoes.length > MAX_OBSERVACOES) {
      registrar(
        'observacoes',
        'checkin-observacoes',
        `As observações devem ter no máximo ${MAX_OBSERVACOES} caracteres.`,
      );
    }

    if (totalPresentes < 1) {
      registrar('form', 'checkin-principal-cpf', 'Informe pelo menos uma pessoa presente.');
    }

    return { erros: novosErros, primeiroId };
  };

  const abrirConfirmacao = () => {
    if (!detalhe || !reserva || modoLeitura) return;
    const { erros: novosErros, primeiroId } = validar();
    setErros(novosErros);
    setErroForm(null);
    if (Object.keys(novosErros).length > 0) {
      window.setTimeout(() => {
        const campo = primeiroId ? document.getElementById(primeiroId) : null;
        campo?.focus();
        campo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    setConfirmarAberto(true);
  };

  const enviar = async () => {
    if (!reservaId) return;
    const corpo: Record<string, unknown> = { reservaId };

    const principalBody: Record<string, string> = {};
    if (principal.cpf.trim()) principalBody.cpf = principal.cpf.trim();
    if (principal.documento.trim()) {
      // Mesmo valor em dois lugares: `documento` (check-in) e `rg` (cadastro do hóspede).
      principalBody.documento = principal.documento.trim();
      principalBody.rg = principal.documento.trim();
    }
    if (principal.dataNascimento) principalBody.dataNascimento = principal.dataNascimento;
    if (principal.nacionalidade.trim()) principalBody.nacionalidade = principal.nacionalidade.trim();
    if (principal.telefone.trim()) principalBody.telefone = principal.telefone.trim();
    if (Object.keys(principalBody).length > 0) corpo.hospedePrincipal = principalBody;

    const acompanhantesBody = acompanhantes
      .filter((acompanhante) => acompanhante.nome.trim())
      .map((acompanhante) => {
        const item: Record<string, unknown> = {
          nome: acompanhante.nome.trim(),
          presente: acompanhante.presente,
        };
        if (acompanhante.cpf.trim()) item.cpf = acompanhante.cpf.trim();
        if (acompanhante.documento.trim()) item.documento = acompanhante.documento.trim();
        if (acompanhante.dataNascimento) item.dataNascimento = acompanhante.dataNascimento;
        if (acompanhante.telefone.trim()) item.telefone = acompanhante.telefone.trim();
        if (acompanhante.parentesco.trim()) item.parentesco = acompanhante.parentesco.trim();
        if (acompanhante.observacoes.trim()) item.observacoes = acompanhante.observacoes.trim();
        return item;
      });
    if (acompanhantesBody.length > 0) corpo.acompanhantes = acompanhantesBody;
    if (observacoes.trim()) corpo.observacoes = observacoes.trim();

    try {
      setSalvando(true);
      setErroForm(null);
      await checkinsApi.create(corpo);
      setConfirmarAberto(false);
      onSuccess();
    } catch (erro) {
      setConfirmarAberto(false);
      setErroForm(
        mensagemDeErro(
          erro,
          'Não foi possível realizar o check-in agora. Verifique os dados e tente novamente.',
        ),
      );
      // O alerta de erro fica no topo do conteúdo: garante que ele esteja visível.
      conteudoRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  };

  const hospedePrincipal = detalhe?.reserva.hospede;

  const blocoHospedePrincipal = (
    <FormSection
      title="Hóspede principal"
      description="Dados do cadastro. Complete o que estiver faltando para concluir o check-in."
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: `${radius.lg}px`,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Avatar sx={{ width: 44, height: 44 }}>
          {hospedePrincipal?.nome?.charAt(0)?.toUpperCase() || '?'}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>
              {hospedePrincipal?.nome || 'Hóspede'}
            </Typography>
            <Chip label="Principal" size="small" sx={(t) => ({ bgcolor: toneSurface(t, 'primary'), color: toneColor(t, 'primary'), fontWeight: 700 })} />
          </Stack>
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', wordBreak: 'break-word' }}>
            {hospedePrincipal?.email || 'E-mail não informado'}
            {hospedePrincipal?.telefone ? ` · ${hospedePrincipal.telefone}` : ''}
          </Typography>
        </Box>
      </Box>

      <FormGrid columns={2} gap={2}>
        <TextField
          id="checkin-principal-cpf"
          label="CPF"
          value={principal.cpf}
          onChange={(e) => {
            setPrincipal((atual) => ({ ...atual, cpf: e.target.value }));
            limparErro('principal.cpf');
          }}
          error={Boolean(erros['principal.cpf'])}
          helperText={erros['principal.cpf'] ?? 'Opcional · 11 dígitos'}
          slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 14 } }}
          autoComplete="off"
        />
        <TextField
          id="checkin-principal-documento"
          label="RG / documento"
          value={principal.documento}
          onChange={(e) => setPrincipal((atual) => ({ ...atual, documento: e.target.value }))}
          helperText="Opcional"
          autoComplete="off"
        />
        <TextField
          id="checkin-principal-dataNascimento"
          label="Data de nascimento"
          type="date"
          value={principal.dataNascimento}
          onChange={(e) => {
            setPrincipal((atual) => ({ ...atual, dataNascimento: e.target.value }));
            limparErro('principal.dataNascimento');
          }}
          error={Boolean(erros['principal.dataNascimento'])}
          helperText={erros['principal.dataNascimento'] ?? 'Opcional'}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: dayjs().format('YYYY-MM-DD') },
          }}
          sx={(t) => ({ '& input': { colorScheme: t.palette.mode } })}
        />
        <TextField
          id="checkin-principal-nacionalidade"
          label="Nacionalidade"
          value={principal.nacionalidade}
          onChange={(e) => setPrincipal((atual) => ({ ...atual, nacionalidade: e.target.value }))}
          helperText="Opcional"
          autoComplete="off"
        />
        <FormSpan span={2}>
          <TextField
            id="checkin-principal-telefone"
            label="Telefone"
            value={principal.telefone}
            onChange={(e) => setPrincipal((atual) => ({ ...atual, telefone: e.target.value }))}
            helperText="Opcional · usado para contato durante a estadia"
            slotProps={{ htmlInput: { inputMode: 'tel' } }}
            autoComplete="off"
          />
        </FormSpan>
      </FormGrid>
    </FormSection>
  );

  const formCheckin = (
    <>
      {hospedePrincipal && blocoHospedePrincipal}

      <AcompanhantesEditor
        acompanhantes={acompanhantes}
        onChange={setAcompanhantes}
        onEditarCampo={limparErro}
        onEstruturaChange={() =>
          setErros((atual) =>
            Object.fromEntries(
              Object.entries(atual).filter(([chave]) => !chave.startsWith('acompanhantes.')),
            ),
          )
        }
        erros={erros}
      />

      <FormSection title="Observações do check-in" description="Informações que a recepção deve registrar.">
        <TextField
          id="checkin-observacoes"
          label="Observações"
          value={observacoes}
          onChange={(e) => {
            setObservacoes(e.target.value.slice(0, MAX_OBSERVACOES));
            limparErro('observacoes');
          }}
          multiline
          minRows={3}
          error={Boolean(erros['observacoes'])}
          helperText={erros['observacoes'] ?? `${observacoes.length}/${MAX_OBSERVACOES} caracteres`}
          slotProps={{ htmlInput: { maxLength: MAX_OBSERVACOES, 'aria-label': 'Observações do check-in' } }}
        />
      </FormSection>
    </>
  );

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={fechar}
        aria-labelledby="checkin-drawer-titulo"
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
              <HowToReg />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                id="checkin-drawer-titulo"
                variant="h6"
                component="h2"
                tabIndex={-1}
                ref={tituloRef}
                sx={{ outline: 'none', fontWeight: 700 }}
              >
                {modoLeitura ? 'Check-in realizado' : 'Realizar check-in'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ wordBreak: 'break-word' }}>
                {reserva ? `Reserva ${reserva.codigoReserva} · ${reserva.hospede?.nome || 'Hóspede'}` : 'Carregando dados da reserva…'}
              </Typography>
            </Box>
            <IconButton onClick={fechar} aria-label="Fechar painel de check-in" sx={{ minWidth: 44, minHeight: 44 }}>
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
                <InlineLoading label="Carregando pré-check-in…" />
              </Box>
            ) : erroCarga ? (
              <ErrorState
                compact
                title="Não foi possível carregar o check-in"
                description={erroCarga}
                onRetry={carregar}
              />
            ) : detalhe ? (
              <>
                <FormError message={erroForm} />

                {!detalhe.elegivel && detalhe.motivoInelegibilidade && (
                  <Alert severity="error" icon={<LockOutlined />} role="alert">
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Check-in indisponível
                    </Typography>
                    <Typography variant="body2">{detalhe.motivoInelegibilidade}</Typography>
                  </Alert>
                )}

                {avisos.map((aviso, indice) => (
                  <Alert
                    key={`${aviso.codigo}-${indice}`}
                    severity={severidadeAviso(aviso)}
                    icon={severidadeAviso(aviso) === 'info' ? <InfoOutlined /> : <WarningAmber />}
                  >
                    {textoAviso(aviso)}
                  </Alert>
                ))}

                {reserva && <ResumoReservaCheckin reserva={reserva} modoLeitura={modoLeitura} />}

                {modoLeitura && detalhe.checkin ? (
                  <CheckinRealizadoResumo checkin={detalhe.checkin} />
                ) : (
                  formCheckin
                )}

                {salvando && <InlineLoading label="Registrando check-in…" />}
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
                      !detalhe.elegivel ? detalhe.motivoInelegibilidade || 'Check-in indisponível' : ''
                    }
                  >
                    <span style={{ display: 'inline-flex', width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <HowToReg />}
                        onClick={abrirConfirmacao}
                        disabled={salvando || !detalhe.elegivel}
                        aria-busy={salvando}
                        sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
                      >
                        {salvando ? 'Salvando…' : 'Confirmar check-in'}
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
        title="Confirmar check-in"
        confirmLabel="Confirmar check-in"
        cancelLabel="Voltar"
        loading={salvando}
        onConfirm={enviar}
        onClose={() => {
          if (!salvando) setConfirmarAberto(false);
        }}
        description={
          <>
            O check-in da reserva <strong>{reserva?.codigoReserva}</strong> de{' '}
            <strong>{reserva?.hospede?.nome || 'hóspede'}</strong> será registrado.
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
                label="Presentes no check-in"
                value={`${totalPresentes} ${totalPresentes === 1 ? 'pessoa' : 'pessoas'}`}
                emphasis
              />
              <InfoItem label="Acompanhantes" value={`${acompanhantes.length} de ${MAX_ACOMPANHANTES}`} />
            </InfoGrid>
          </Box>
        )}
      </ConfirmDialog>
    </>
  );
}
