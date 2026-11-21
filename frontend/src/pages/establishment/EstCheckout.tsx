import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  TablePagination,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ClearAll,
  Logout,
  MeetingRoom,
  Refresh,
  TaskAlt,
  Today,
  WarningAmber,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  DataToolbar,
  DataToolbarGroup,
  EmptySearchIcon,
  EmptyState,
  ErrorState,
  PageContainer,
  PageHeader,
  PageLoading,
  SearchField,
  SectionCard,
  StatCard,
  TableSkeleton,
} from '../../components/common';
import { CheckoutDrawer } from '../../components/checkout/CheckoutDrawer';
import { CheckoutLista } from '../../components/checkout/CheckoutLista';
import type {
  CheckoutListItem,
  ResumoCheckouts,
  SituacaoFiltroCheckout,
} from '../../components/checkout/contrato';
import { formatDate, radius } from '../../theme/tokens';
import { checkoutsApi, establishmentsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

/** Abas de filtro — todas usam `situacao`; a data é um refinamento opcional. */
const ABAS: { label: string; situacao: SituacaoFiltroCheckout }[] = [
  { label: 'Em andamento', situacao: 'EM_ANDAMENTO' },
  { label: 'Saídas hoje', situacao: 'SAIDAS_HOJE' },
  { label: 'Atrasados', situacao: 'ATRASADOS' },
  { label: 'Realizados', situacao: 'REALIZADOS' },
  { label: 'Todos', situacao: 'TODOS' },
];

const RESUMO_VAZIO: ResumoCheckouts = {
  emAndamento: 0,
  saidasHoje: 0,
  atrasados: 0,
  realizadosHoje: 0,
};

interface EstabelecimentoOpcao {
  id: string;
  nome: string;
}

/**
 * Mensagem amigável do erro do backend. O `ValidationPipe` devolve
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

/**
 * Dia operacional no fuso do servidor (America/Fortaleza) no formato `YYYY-MM-DD`.
 * Evita divergir da data do backend quando o dispositivo está em outro fuso.
 */
function dataOperacionalHoje(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Estilo de conteúdo só para leitores de tela (anúncio aria-live).
 * ATENÇÃO: valores numéricos ≤ 1 no `sx` do MUI viram porcentagem (width: 1 → 100%);
 * por isso as medidas abaixo são strings em px.
 */
const somenteLeitorDeTela = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** Rótulo curto do filtro atual, exibido na barra de ferramentas. */
function rotuloFiltro(aba: number, dataFiltro: string, hoje: string): string {
  if (dataFiltro) return `Data da saída: ${formatDate(dataFiltro)}`;
  switch (aba) {
    case 0:
      return 'Hospedagens em andamento';
    case 1:
      return `Saídas de ${formatDate(hoje)}`;
    case 2:
      return 'Saídas com data vencida';
    case 3:
      return `Encerrados em ${formatDate(hoje)}`;
    default:
      return 'Todas as situações';
  }
}

export default function EstCheckout() {
  const { user } = useAuthStore();

  const [estabelecimentos, setEstabelecimentos] = useState<EstabelecimentoOpcao[]>([]);
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [erroEstabelecimentos, setErroEstabelecimentos] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const [itens, setItens] = useState<CheckoutListItem[]>([]);
  const [resumo, setResumo] = useState<ResumoCheckouts | null>(null);
  const [total, setTotal] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  const [aba, setAba] = useState(0);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [dataFiltro, setDataFiltro] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [reservaSelecionada, setReservaSelecionada] = useState<string | null>(null);

  const hoje = dataOperacionalHoje();

  // 1) Estabelecimentos do usuário (selector só aparece com mais de um).
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await establishmentsApi.getMy();
        let lista: EstabelecimentoOpcao[] = res.data?.data ?? res.data ?? [];
        const vinculado = (user as { estabelecimentoVinculadoId?: string } | null)
          ?.estabelecimentoVinculadoId;

        if ((!Array.isArray(lista) || lista.length === 0) && vinculado) {
          try {
            const unico = await establishmentsApi.getOne(vinculado);
            const est = unico.data?.data ?? unico.data;
            if (est) lista = [est];
          } catch {
            // Sem vínculo acessível: a listagem resolve o estabelecimento no backend.
          }
        }

        if (!ativo) return;
        const listaFinal = Array.isArray(lista) ? lista : [];
        setEstabelecimentos(listaFinal);
        setEstabelecimentoId((atual) => atual || listaFinal[0]?.id || '');
      } catch (erro) {
        if (!ativo) return;
        setErroEstabelecimentos(
          mensagemDeErro(
            erro,
            'Não foi possível carregar seus estabelecimentos. A listagem usa o vínculo da sua conta.',
          ),
        );
      } finally {
        if (ativo) setBooting(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [user]);

  // 2) Debounce da busca (~350 ms) — evita uma requisição por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  // 3) Listagem paginada, sempre server-side (só depois do bootstrap do vínculo).
  useEffect(() => {
    if (booting) return;
    let ativo = true;
    (async () => {
      setCarregandoLista(true);
      setErroLista(null);
      try {
        const params: Record<string, unknown> = {
          situacao: ABAS[aba]?.situacao ?? 'TODOS',
          page: page + 1,
          limit: rowsPerPage,
        };
        if (estabelecimentoId) params.estabelecimentoId = estabelecimentoId;
        if (dataFiltro) params.data = dataFiltro;
        if (buscaAplicada) params.busca = buscaAplicada;

        const res = await checkoutsApi.list(params);
        const payload = res.data?.data ?? res.data;
        const lista: CheckoutListItem[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];

        if (!ativo) return;
        setItens(lista);
        const totalCarregado = Number(payload?.total ?? lista.length);
        setTotal(totalCarregado);
        if (payload?.resumo) setResumo(payload.resumo as ResumoCheckouts);
        // Página fora de alcance (ex.: último item saiu do filtro) volta para a primeira.
        if (lista.length === 0 && totalCarregado > 0 && page > 0) setPage(0);
      } catch (erro) {
        if (!ativo) return;
        setErroLista(
          mensagemDeErro(erro, 'Não foi possível carregar os check-outs. Tente novamente.'),
        );
      } finally {
        if (ativo) setCarregandoLista(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [estabelecimentoId, page, rowsPerPage, aba, buscaAplicada, dataFiltro, recarregar, booting]);

  const resumoAtual: ResumoCheckouts = { ...RESUMO_VAZIO, ...(resumo ?? {}) };
  const filtrosAtivos = Boolean(dataFiltro || buscaAplicada || aba !== 0);

  const limparFiltros = () => {
    setAba(0);
    setBusca('');
    setBuscaAplicada('');
    setDataFiltro('');
    setPage(0);
  };

  const abrirDrawer = (reservaId: string) => {
    setReservaSelecionada(reservaId);
    setDrawerAberto(true);
  };

  const handleSucessoDrawer = () => {
    setDrawerAberto(false);
    setReservaSelecionada(null);
    setRecarregar((valor) => valor + 1);
    toast.success('Check-out realizado — hospedagem encerrada.');
  };

  const emptyState = () => {
    if (buscaAplicada) {
      return (
        <EmptyState
          icon={EmptySearchIcon}
          title="Nenhum resultado para esta busca"
          description="Não encontramos check-outs para o termo informado. Ajuste a busca ou limpe os filtros."
          action={
            <Button size="small" variant="outlined" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<Logout />}
        title={
          aba === 0
            ? 'Nenhuma hospedagem em andamento'
            : aba === 1
              ? 'Nenhuma saída prevista para hoje'
              : aba === 2
                ? 'Nenhuma saída atrasada'
                : aba === 3
                  ? 'Nenhum check-out realizado hoje'
                  : 'Nenhum check-out encontrado'
        }
        description={
          aba === 0
            ? 'Hospedagens com check-in feito e check-out pendente aparecem aqui.'
            : aba === 2
              ? 'Todas as saídas estão dentro do prazo previsto.'
              : aba === 3
                ? 'As hospedagens encerradas pela recepção aparecem aqui.'
                : 'Ajuste os filtros ou selecione outra data de saída.'
        }
      />
    );
  };

  const renderLista = () => {
    if (carregandoLista) {
      return (
        <Box sx={{ p: { xs: 2, md: 2.5 } }} aria-busy="true">
          <TableSkeleton rows={Math.min(rowsPerPage, 8)} columns={6} />
        </Box>
      );
    }

    if (erroLista) {
      return (
        <ErrorState
          title="Não foi possível carregar os check-outs"
          description={erroLista}
          onRetry={() => setRecarregar((valor) => valor + 1)}
        />
      );
    }

    if (itens.length === 0) return emptyState();

    return (
      <>
        <CheckoutLista itens={itens} onAbrir={abrirDrawer} />

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_evento, novaPagina) => setPage(novaPagina)}
            onRowsPerPageChange={(evento) => {
              setRowsPerPage(parseInt(evento.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
            }
            sx={{
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: { xs: 'center', sm: 'flex-end' },
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: '0.8125rem',
              },
            }}
          />
        </Box>
      </>
    );
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Operação"
        title="Check-out"
        subtitle="Encerre hospedagens em andamento e confira pendências antes de liberar a acomodação."
        icon={<Logout />}
        actions={
          <>
            {estabelecimentos.length > 1 && (
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="checkout-estabelecimento-label">Estabelecimento</InputLabel>
                <Select
                  labelId="checkout-estabelecimento-label"
                  value={estabelecimentoId}
                  label="Estabelecimento"
                  onChange={(evento) => {
                    setEstabelecimentoId(evento.target.value);
                    setPage(0);
                  }}
                >
                  {estabelecimentos.map((estabelecimento) => (
                    <MenuItem key={estabelecimento.id} value={estabelecimento.id}>
                      {estabelecimento.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Button
              variant="outlined"
              startIcon={
                carregandoLista ? <CircularProgress size={16} color="inherit" /> : <Refresh />
              }
              onClick={() => setRecarregar((valor) => valor + 1)}
              disabled={carregandoLista || booting}
              sx={{ minHeight: 44 }}
            >
              Atualizar
            </Button>
          </>
        }
      />

      {booting ? (
        <PageLoading label="Carregando central de check-out…" minHeight="40vh" />
      ) : (
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {erroEstabelecimentos && (
            <Alert severity="warning" role="status">
              {erroEstabelecimentos}
            </Alert>
          )}

          {/* Indicadores operacionais — 2x2 no mobile para a lista ficar mais perto da dobra */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              minWidth: 0,
            }}
          >
            <StatCard
              label="Em andamento"
              value={resumoAtual.emAndamento}
              icon={<MeetingRoom />}
              tone="info"
              hint="Hóspedes no estabelecimento"
              loading={!resumo && !erroLista}
              sx={{ borderRadius: `${radius.xl}px`, p: { xs: 1.75, sm: 2.5 } }}
            />
            <StatCard
              label="Saídas hoje"
              value={resumoAtual.saidasHoje}
              icon={<Today />}
              tone="warning"
              hint="Check-out previsto para hoje"
              loading={!resumo && !erroLista}
              sx={{ borderRadius: `${radius.xl}px`, p: { xs: 1.75, sm: 2.5 } }}
            />
            <StatCard
              label="Atrasados"
              value={resumoAtual.atrasados}
              icon={<WarningAmber />}
              tone="error"
              hint="Data de saída já passou"
              loading={!resumo && !erroLista}
              sx={{ borderRadius: `${radius.xl}px`, p: { xs: 1.75, sm: 2.5 } }}
            />
            <StatCard
              label="Check-outs hoje"
              value={resumoAtual.realizadosHoje}
              icon={<TaskAlt />}
              tone="success"
              hint="Encerrados pela recepção"
              loading={!resumo && !erroLista}
              sx={{ borderRadius: `${radius.xl}px`, p: { xs: 1.75, sm: 2.5 } }}
            />
          </Box>

          {/* Lista operacional */}
          <SectionCard
            title="Hospedagens"
            subtitle={`${total} ${total === 1 ? 'registro' : 'registros'} no filtro atual`}
            noPadding
            contentSx={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%' }}
          >
            <Tabs
              value={aba}
              onChange={(_evento, valor) => {
                setAba(valor);
                setPage(0);
              }}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              indicatorColor="primary"
              sx={{ px: { xs: 1, md: 2 } }}
              aria-label="Filtrar check-outs por situação"
            >
              {ABAS.map((configuracao) => (
                <Tab key={configuracao.label} label={configuracao.label} />
              ))}
            </Tabs>

            <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5, minWidth: 0, maxWidth: '100%' }}>
              <DataToolbar sx={{ mb: 0, minWidth: 0, maxWidth: '100%' }}>
                <DataToolbarGroup sx={{ minWidth: 0, rowGap: 1.5 }}>
                  <Box
                    sx={{
                      flex: { xs: '1 1 100%', sm: '0 0 auto' },
                      minWidth: 0,
                      maxWidth: '100%',
                    }}
                  >
                    <SearchField
                      value={busca}
                      onChange={setBusca}
                      placeholder="Buscar por hóspede, código ou quarto"
                      width={320}
                      inputProps={{ 'aria-label': 'Buscar check-out por hóspede, código ou quarto' }}
                    />
                  </Box>
                  <TextField
                    type="date"
                    size="small"
                    label="Data da saída"
                    value={dataFiltro}
                    onChange={(evento) => {
                      setDataFiltro(evento.target.value);
                      setPage(0);
                    }}
                    slotProps={{
                      inputLabel: { shrink: true },
                    }}
                    sx={(t) => ({
                      width: { xs: '100%', sm: 190 },
                      minWidth: 0,
                      flexShrink: { sm: 0 },
                      '& input': { colorScheme: t.palette.mode },
                    })}
                  />
                  <Button
                    variant="text"
                    startIcon={<ClearAll />}
                    onClick={limparFiltros}
                    disabled={!filtrosAtivos}
                    sx={{ minHeight: 44, width: { xs: '100%', sm: 'auto' } }}
                  >
                    Limpar filtros
                  </Button>
                </DataToolbarGroup>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ textAlign: { xs: 'left', md: 'right' }, flexShrink: 0 }}
                >
                  {rotuloFiltro(aba, dataFiltro, hoje)}
                </Typography>
              </DataToolbar>
            </Box>

            {renderLista()}
          </SectionCard>

          {/* Anúncio para leitores de tela após cada recarga */}
          <Box role="status" aria-live="polite" sx={somenteLeitorDeTela}>
            {carregandoLista
              ? 'Carregando check-outs.'
              : `${total} ${total === 1 ? 'check-out listado' : 'check-outs listados'}.`}
          </Box>
        </Stack>
      )}

      <CheckoutDrawer
        open={drawerAberto}
        reservaId={reservaSelecionada}
        onClose={() => {
          setDrawerAberto(false);
          setReservaSelecionada(null);
        }}
        onSuccess={handleSucessoDrawer}
      />
    </PageContainer>
  );
}
