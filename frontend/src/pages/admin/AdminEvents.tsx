import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  EmojiEvents,
  Event as EventIcon,
  ImageOutlined,
  OpenInNew,
  StarBorderOutlined,
  StarOutlined,
} from '@mui/icons-material';
import {
  ConfirmDialog,
  DataToolbar,
  DataToolbarGroup,
  EmptySearchIcon,
  EmptyState,
  ErrorState,
  FormGrid,
  FormSection,
  FormSpan,
  InlineLoading,
  PageContainer,
  PageHeader,
  SearchField,
  SectionCard,
  TableSkeleton,
} from '../../components/common';
import { formatDate } from '../../theme/tokens';
import { eventsApi, citiesApi, fotosApi, uploadsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface City {
  id: string;
  nome: string;
}

interface EventCity {
  cidade: City;
}

/** Foto do evento conforme o contrato de `GET /eventos` / `GET /fotos/evento/:id`. */
interface EventPhoto {
  id: string;
  url: string;
  isCapa: boolean;
  ordem: number;
}

interface EventData {
  id: string;
  nome: string;
  descricao?: string;
  linkOficial?: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  eventosCidades: EventCity[];
  fotos?: EventPhoto[];
}

/** Arquivo novo ainda não enviado (só existe no diálogo, com prévia local). */
interface FotoSelecionada {
  id: string;
  file: File;
  previewUrl: string;
}

const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;

/**
 * `@db.Date` chega como meia-noite UTC; formatar em UTC evita exibir o dia anterior.
 */
const DATA_EVENTO: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
};

/**
 * Mensagem de erro útil ao admin: usa a resposta da API quando existe e
 * diferencia queda de rede/backend fora do ar de erro de validação.
 */
function descreverErro(err: unknown, padrao: string) {
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    request?: unknown;
    code?: string;
  };
  const message = e?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return `${padrao}: ${message.join('; ')}`;
  if (typeof message === 'string' && message) return `${padrao}: ${message}`;
  if (e?.code === 'ERR_NETWORK' || (e?.request && !e?.response)) {
    return `${padrao}: não foi possível conectar à API. Verifique se o backend está rodando.`;
  }
  return padrao;
}

/** Libera a URL de prévia criada por `URL.createObjectURL`. */
function revogarPreview(url: string | null) {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [linkOficial, setLinkOficial] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);

  // Fotos do evento — estado staged: só é aplicado ao salvar.
  const [eventFotos, setEventFotos] = useState<EventPhoto[]>([]);
  const [capaOriginalId, setCapaOriginalId] = useState<string | null>(null);
  const [fotosRemovidas, setFotosRemovidas] = useState<EventPhoto[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [novasFotos, setNovasFotos] = useState<FotoSelecionada[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
      const [eventsRes, citiesRes] = await Promise.all([
        eventsApi.getAll(),
        citiesApi.getAll(true),
      ]);
      setEvents(eventsRes.data.data || []);
      setCities(citiesRes.data.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error(descreverErro(err, 'Erro ao carregar eventos/cidades'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /** Valida tipo e tamanho de uma imagem escolhida pelo usuário. */
  const validarImagem = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(`"${file.name}" não é uma imagem. Envie JPG, PNG ou WebP.`);
      return false;
    }
    if (file.size > TAMANHO_MAXIMO_FOTO) {
      toast.error(`"${file.name}" tem mais de 10 MB.`);
      return false;
    }
    return true;
  };

  /** Zera todo o estado de fotos do diálogo, liberando prévias locais. */
  const resetFotosState = () => {
    revogarPreview(coverPreview);
    novasFotos.forEach((foto) => revogarPreview(foto.previewUrl));
    setEventFotos([]);
    setCapaOriginalId(null);
    setFotosRemovidas([]);
    setCoverFile(null);
    setCoverPreview(null);
    setNovasFotos([]);
  };

  // Libera as prévias locais quando o componente sai de cena.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = [
      coverPreview,
      ...novasFotos.map((foto) => foto.previewUrl),
    ].filter((url): url is string => Boolean(url));
  }, [coverPreview, novasFotos]);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => revogarPreview(url));
    };
  }, []);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite escolher o mesmo arquivo novamente depois de remover.
    e.target.value = '';
    if (!file || !validarImagem(file)) return;

    revogarPreview(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCoverRemove = () => {
    revogarPreview(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const validas = files.filter(validarImagem);
    if (validas.length === 0) return;

    setNovasFotos((prev) => [
      ...prev,
      ...validas.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}-${file.size}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const handleRemoverNovaFoto = (id: string) => {
    setNovasFotos((prev) => {
      const alvo = prev.find((foto) => foto.id === id);
      if (alvo) revogarPreview(alvo.previewUrl);
      return prev.filter((foto) => foto.id !== id);
    });
  };

  /** Define uma foto já existente como capa (staged: só vale no salvar). */
  const handleDefinirCapaExistente = (id: string) => {
    setEventFotos((prev) => prev.map((foto) => ({ ...foto, isCapa: foto.id === id })));
  };

  /** Marca uma foto existente para remoção (staged: só vale no salvar). */
  const handleRemoverFotoExistente = (foto: EventPhoto) => {
    setEventFotos((prev) => prev.filter((item) => item.id !== foto.id));
    setFotosRemovidas((prev) => (prev.some((item) => item.id === foto.id) ? prev : [...prev, foto]));
  };

  const handleOpenAdd = () => {
    setSelectedEvent(null);
    setNome('');
    setDescricao('');
    setLinkOficial('');
    setDataInicio('');
    setDataFim('');
    setSelectedCityIds([]);
    resetFotosState();
    setOpenDialog(true);
  };

  const handleOpenEdit = (evt: EventData) => {
    setSelectedEvent(evt);
    setNome(evt.nome);
    setDescricao(evt.descricao || '');
    setLinkOficial(evt.linkOficial || '');

    // Converte a string ISO para YYYY-MM-DD aceito pelo input de data
    const startStr = evt.dataInicio ? new Date(evt.dataInicio).toISOString().split('T')[0] : '';
    const endStr = evt.dataFim ? new Date(evt.dataFim).toISOString().split('T')[0] : '';
    setDataInicio(startStr);
    setDataFim(endStr);

    const cityIds = (evt.eventosCidades || []).map((ec) => ec.cidade.id);
    setSelectedCityIds(cityIds);

    // Pré-carrega as fotos que já vêm no payload do evento.
    resetFotosState();
    const fotos = evt.fotos ?? [];
    setEventFotos(fotos.map((foto) => ({ ...foto })));
    setCapaOriginalId(fotos.find((foto) => foto.isCapa)?.id ?? null);

    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!nome || !dataInicio || !dataFim) {
      toast.error('Preencha os campos obrigatórios (Nome, Data Início e Fim)');
      return;
    }

    const payload = {
      nome,
      descricao,
      linkOficial,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
      cityIds: selectedCityIds,
    };

    setSaving(true);
    const falhas: string[] = [];
    let eventId: string | null = null;
    let criouEvento = false;

    try {
      // 1) Cria/atualiza o evento e obtém o id.
      if (selectedEvent) {
        await eventsApi.update(selectedEvent.id, payload);
        eventId = selectedEvent.id;
      } else {
        const res = await eventsApi.create(payload);
        const criado = res.data.data || res.data;
        eventId = criado?.id ?? null;
        criouEvento = true;
        if (!eventId) {
          throw new Error('A resposta da criação do evento não trouxe o id');
        }
      }

      // 2) Aplica as remoções de fotos antigas.
      for (const foto of [...fotosRemovidas]) {
        try {
          await fotosApi.delete(foto.id);
          setFotosRemovidas((prev) => prev.filter((item) => item.id !== foto.id));
        } catch (err) {
          console.error(err);
          falhas.push('remover uma das fotos antigas');
          // Se a remoção falhar, a foto continua publicada: devolve à grade em vez de sumir.
          setEventFotos((prev) =>
            prev.some((item) => item.id === foto.id)
              ? prev
              : [...prev, foto].sort((a, b) => a.ordem - b.ordem),
          );
        }
      }

      // 3) Envia os novos arquivos e cria as fotos (sempre sem capa).
      const maiorOrdem = eventFotos.reduce((max, foto) => Math.max(max, foto.ordem), -1);
      let proximaOrdem = Math.max(eventFotos.length, maiorOrdem + 1);
      let primeiraFotoCriadaId: string | null = null;

      const enviarFoto = async (file: File) => {
        try {
          const uploadRes = await uploadsApi.uploadImage('eventos', file);
          const uploaded = uploadRes.data.data || uploadRes.data;
          if (!uploaded?.url) throw new Error('A resposta do upload não trouxe a URL');

          const fotoRes = await fotosApi.create({
            url: uploaded.url,
            s3Key: uploaded.s3Key || uploaded.key,
            eventoId: eventId,
            isCapa: false,
            ordem: proximaOrdem,
          });
          proximaOrdem += 1;

          const criada = fotoRes.data.data || fotoRes.data;
          const criadaId: string | null = criada?.id ?? null;
          if (criadaId && !primeiraFotoCriadaId) primeiraFotoCriadaId = criadaId;
          return criadaId;
        } catch (err) {
          console.error(err);
          return null;
        }
      };

      for (const nova of [...novasFotos]) {
        const criadaId = await enviarFoto(nova.file);
        if (!criadaId) {
          falhas.push(`enviar a foto "${nova.file.name}"`);
          continue;
        }
        setNovasFotos((prev) => {
          const alvo = prev.find((foto) => foto.id === nova.id);
          if (alvo) revogarPreview(alvo.previewUrl);
          return prev.filter((foto) => foto.id !== nova.id);
        });
      }

      let capaNovaId: string | null = null;
      if (coverFile) {
        capaNovaId = await enviarFoto(coverFile);
        if (!capaNovaId) {
          falhas.push('enviar a nova foto de capa');
        } else {
          revogarPreview(coverPreview);
          setCoverFile(null);
          setCoverPreview(null);
        }
      }

      // 4) Define a capa final.
      const capaStaged = eventFotos.find((foto) => foto.isCapa) ?? null;
      let capaDefinida = false;

      if (capaNovaId) {
        try {
          await fotosApi.update(capaNovaId, { isCapa: true });
          capaDefinida = true;
          setCapaOriginalId(capaNovaId);
        } catch (err) {
          console.error(err);
          falhas.push('definir a nova foto de capa');
        }
      } else if (capaStaged) {
        if (capaStaged.id === capaOriginalId) {
          capaDefinida = true;
        } else {
          try {
            await fotosApi.update(capaStaged.id, { isCapa: true });
            capaDefinida = true;
            setCapaOriginalId(capaStaged.id);
          } catch (err) {
            console.error(err);
            falhas.push('definir a foto escolhida como capa');
          }
        }
      }

      // Evento sem capa com fotos disponíveis: a primeira vira capa.
      if (!capaDefinida) {
        const primeiraExistente = [...eventFotos].sort((a, b) => a.ordem - b.ordem)[0];
        const alvoCapa = primeiraExistente?.id ?? primeiraFotoCriadaId;
        if (alvoCapa) {
          try {
            await fotosApi.update(alvoCapa, { isCapa: true });
            capaDefinida = true;
            setCapaOriginalId(alvoCapa);
          } catch (err) {
            console.error(err);
            falhas.push('definir a capa do evento');
          }
        }
      }

      if (falhas.length > 0) {
        toast.error(
          `Evento salvo, mas falhou: ${falhas.join('; ')}. As demais fotos foram salvas — revise e tente novamente.`,
        );
        // Mantém o diálogo aberto e garante que a nova tentativa atualize em vez de duplicar.
        if (criouEvento && eventId) {
          setSelectedEvent({
            id: eventId,
            nome,
            descricao,
            linkOficial,
            dataInicio,
            dataFim,
            ativo: true,
            eventosCidades: [],
            fotos: [],
          });
        }
        fetchData();
        return;
      }

      toast.success(criouEvento ? 'Evento cadastrado com sucesso' : 'Evento atualizado com sucesso');
      setOpenDialog(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(
        descreverErro(err, criouEvento ? 'Erro ao cadastrar evento' : 'Erro ao salvar evento'),
        { duration: 6000 },
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (evt: EventData) => {
    setEventToDelete(evt);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    try {
      setDeleting(true);
      await eventsApi.delete(eventToDelete.id);
      toast.success('Evento excluído com sucesso');
      setConfirmDeleteOpen(false);
      setEventToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(descreverErro(err, 'Erro ao excluir evento'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setEventToDelete(null);
  };

  const term = search.trim().toLowerCase();
  const filteredEvents = term
    ? events.filter(
        (evt) =>
          evt.nome.toLowerCase().includes(term) ||
          (evt.descricao || '').toLowerCase().includes(term) ||
          (evt.eventosCidades || []).some((ec) => ec.cidade.nome.toLowerCase().includes(term)),
      )
    : events;

  // Capa que será exibida na prévia: a nova seleção tem prioridade sobre a atual.
  const capaExistente = coverFile
    ? null
    : eventFotos.find((foto) => foto.isCapa) ?? null;
  const capaPreviewUrl = coverPreview ?? capaExistente?.url ?? null;
  const totalFotos = eventFotos.length + novasFotos.length;

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        overline="Catálogo"
        title="Eventos"
        subtitle="Cadastre os grandes eventos regionais e vincule-os às cidades parceiras."
        icon={<EmojiEvents />}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
            Novo evento
          </Button>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por evento ou cidade"
            width={320}
          />
        </DataToolbarGroup>
        <Typography variant="caption" color="textSecondary">
          {filteredEvents.length} de {events.length} {events.length === 1 ? 'evento' : 'eventos'}
        </Typography>
      </DataToolbar>

      <SectionCard noPadding>
        {loading ? (
          <Box sx={{ p: 2.5 }}>
            <TableSkeleton rows={5} columns={5} />
          </Box>
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar os eventos"
            description="Ocorreu uma falha ao buscar os eventos e as cidades vinculadas."
            onRetry={fetchData}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<EmojiEvents />}
            title="Nenhum evento cadastrado"
            description="Cadastre eventos regionais para destacá-los nas cidades participantes."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
                Novo evento
              </Button>
            }
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={EmptySearchIcon}
            title="Nenhum evento encontrado"
            description="Ajuste a busca para encontrar o evento desejado."
            action={
              <Button variant="outlined" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            }
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Evento</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell>Cidades vinculadas</TableCell>
                  <TableCell>Link oficial</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvents.map((evt) => (
                  <TableRow key={evt.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {(() => {
                          const capa = (evt.fotos ?? []).find((foto) => foto.isCapa);
                          return capa ? (
                            <Box
                              component="img"
                              src={capa.url}
                              alt={`Capa do evento ${evt.nome}`}
                              loading="lazy"
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                objectFit: 'cover',
                                flexShrink: 0,
                                bgcolor: 'action.hover',
                              }}
                            />
                          ) : (
                            <Box
                              aria-hidden
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'action.hover',
                                color: 'secondary.main',
                                flexShrink: 0,
                              }}
                            >
                              <EventIcon sx={{ fontSize: 18 }} />
                            </Box>
                          );
                        })()}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {evt.nome}
                          </Typography>
                          {evt.descricao && (
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              noWrap
                              sx={{ display: 'block', maxWidth: 320 }}
                            >
                              {evt.descricao}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(evt.dataInicio, DATA_EVENTO)}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        até {formatDate(evt.dataFim, DATA_EVENTO)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(evt.eventosCidades || []).length === 0 ? (
                        <Typography variant="caption" color="textSecondary">
                          Global (sem cidade)
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {evt.eventosCidades.map((ec) => (
                            <Chip key={ec.cidade.id} label={ec.cidade.nome} size="small" />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {evt.linkOficial ? (
                        <MuiLink
                          href={evt.linkOficial}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Abrir site oficial de ${evt.nome} em nova aba`}
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                        >
                          Site oficial <OpenInNew fontSize="inherit" aria-hidden />
                        </MuiLink>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Nenhum
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar evento ${evt.nome}`}
                            onClick={() => handleOpenEdit(evt)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Excluir evento ${evt.nome}`}
                            onClick={() => handleDeleteClick(evt)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      {/* Diálogo de cadastro/edição */}
      <Dialog
        open={openDialog}
        onClose={() => {
          if (!saving) setOpenDialog(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{selectedEvent ? 'Editar evento' : 'Cadastrar evento'}</DialogTitle>
        <DialogContent>
          <FormSection
            title="Informações do evento"
            description="Nome e descrição aparecem nas páginas das cidades vinculadas."
          >
            <FormGrid columns={2}>
              <FormSpan span={2}>
                <TextField
                  label="Nome do evento"
                  fullWidth
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </FormSpan>
              <FormSpan span={2}>
                <TextField
                  label="Link oficial (ex: https://...)"
                  fullWidth
                  value={linkOficial}
                  onChange={(e) => setLinkOficial(e.target.value)}
                />
              </FormSpan>
              <FormSpan span={2}>
                <TextField
                  label="Descrição do evento"
                  multiline
                  rows={3}
                  fullWidth
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </FormSpan>
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <FormSection
            title="Período"
            description="A data de término deve ser igual ou posterior à de início."
          >
            <FormGrid columns={2}>
              <TextField
                label="Data de início"
                type="date"
                fullWidth
                required
                slotProps={{ inputLabel: { shrink: true } }}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
              <TextField
                label="Data de término"
                type="date"
                fullWidth
                required
                slotProps={{ inputLabel: { shrink: true } }}
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <FormSection
            title="Cidades vinculadas"
            description="Sem cidades selecionadas, o evento é tratado como global."
          >
            <FormControl fullWidth>
              <InputLabel>Cidades vinculadas</InputLabel>
              <Select
                multiple
                value={selectedCityIds}
                onChange={(e) => setSelectedCityIds(e.target.value as string[])}
                input={<OutlinedInput label="Cidades vinculadas" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const city = cities.find((c) => c.id === value);
                      return <Chip key={value} label={city?.nome || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {cities.map((city) => (
                  <MenuItem key={city.id} value={city.id}>
                    <Checkbox checked={selectedCityIds.indexOf(city.id) > -1} />
                    <ListItemText primary={city.nome} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <FormSection
            title="Fotos do evento"
            description="A capa aparece nos cards da agenda; as demais fotos ficam na galeria do evento."
          >
            {/* Capa */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Foto de capa
              </Typography>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleCoverSelect}
                aria-label="Selecionar foto de capa do evento"
              />

              {capaPreviewUrl ? (
                <Box sx={{ mt: 1 }}>
                  <Box
                    component="img"
                    src={capaPreviewUrl}
                    alt={
                      coverFile
                        ? `Prévia da nova foto de capa do evento ${nome || 'sem nome'}`
                        : `Foto de capa atual do evento ${nome || 'sem nome'}`
                    }
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 180,
                      objectFit: 'cover',
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    {coverFile ? (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => coverInputRef.current?.click()}
                          disabled={saving}
                        >
                          Trocar imagem
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={handleCoverRemove}
                          disabled={saving}
                        >
                          Remover seleção
                        </Button>
                        <Typography variant="caption" color="textSecondary">
                          Nova capa — enviada ao salvar
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ImageOutlined />}
                          onClick={() => coverInputRef.current?.click()}
                          disabled={saving}
                        >
                          Escolher capa
                        </Button>
                        <Typography variant="caption" color="textSecondary">
                          Capa atual do evento
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Box>
              ) : (
                <Box
                  sx={{
                    mt: 1,
                    p: 2.5,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                >
                  <ImageOutlined aria-hidden sx={{ fontSize: 32, color: 'text.secondary' }} />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, mb: 1.5 }}>
                    Nenhuma capa selecionada. JPG, PNG ou WebP até 10 MB.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={saving}
                  >
                    Escolher capa
                  </Button>
                </Box>
              )}
            </Box>

            {/* Galeria */}
            <Box>
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {totalFotos === 0 ? 'Galeria' : `Galeria (${totalFotos})`}
                </Typography>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleGallerySelect}
                  aria-label="Selecionar fotos adicionais do evento"
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={saving}
                >
                  Adicionar fotos
                </Button>
              </Stack>

              {totalFotos === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                  Nenhuma foto na galeria. Use “Adicionar fotos” para incluir imagens do evento.
                </Typography>
              ) : (
                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      sm: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 1.5,
                  }}
                >
                  {eventFotos.map((foto, index) => {
                    const ehCapa = capaExistente?.id === foto.id;
                    return (
                      <Box
                        key={foto.id}
                        sx={{
                          position: 'relative',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: ehCapa ? 'warning.main' : 'divider',
                        }}
                      >
                        <Box
                          component="img"
                          src={foto.url}
                          alt={`Foto ${index + 1} de ${eventFotos.length} do evento ${
                            nome || 'sem nome'
                          }${ehCapa ? ' — capa' : ''}`}
                          loading="lazy"
                          sx={{
                            display: 'block',
                            width: '100%',
                            height: 104,
                            objectFit: 'cover',
                            bgcolor: 'action.hover',
                          }}
                        />
                        {ehCapa && (
                          <Chip
                            icon={<StarOutlined />}
                            label="Capa"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              bgcolor: 'background.paper',
                              color: 'warning.dark',
                              border: '1px solid',
                              borderColor: 'divider',
                              '& .MuiChip-icon': {
                                color: 'warning.dark',
                                ml: 0.75,
                                mr: -0.25,
                              },
                            }}
                          />
                        )}
                        <Stack
                          direction="row"
                          spacing={0.25}
                          sx={{
                            position: 'absolute',
                            right: 4,
                            bottom: 4,
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            px: 0.25,
                          }}
                        >
                          <Tooltip title="Definir como capa">
                            <span>
                              <IconButton
                                size="small"
                                color="warning"
                                aria-label={`Definir foto ${index + 1} como capa do evento`}
                                onClick={() => handleDefinirCapaExistente(foto.id)}
                                disabled={saving || ehCapa}
                              >
                                <StarBorderOutlined fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Remover foto">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Remover foto ${index + 1} do evento`}
                                onClick={() => handleRemoverFotoExistente(foto)}
                                disabled={saving}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Box>
                    );
                  })}

                  {novasFotos.map((nova, index) => (
                    <Box
                      key={nova.id}
                      sx={{
                        position: 'relative',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px dashed',
                        borderColor: 'primary.main',
                      }}
                    >
                      <Box
                        component="img"
                        src={nova.previewUrl}
                        alt={`Nova foto ${index + 1} selecionada para o evento ${
                          nome || 'sem nome'
                        }`}
                        sx={{
                          display: 'block',
                          width: '100%',
                          height: 104,
                          objectFit: 'cover',
                          bgcolor: 'action.hover',
                        }}
                      />
                      <Chip
                        label="Nova"
                        size="small"
                        color="primary"
                        sx={{ position: 'absolute', top: 6, left: 6 }}
                      />
                      <Tooltip title="Remover seleção">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Remover a nova foto ${index + 1} da seleção`}
                            onClick={() => handleRemoverNovaFoto(nova.id)}
                            disabled={saving}
                            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper' }}
                          >
                            <Delete fontSize="small" color="error" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {saving && <InlineLoading label="Salvando evento e enviando fotos…" />}
          </FormSection>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} loading={saving}>
            {selectedEvent ? 'Salvar alterações' : 'Cadastrar evento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir evento"
        description={
          <>
            Deseja excluir o evento <strong>{eventToDelete?.nome}</strong>? Esta ação não pode ser
            desfeita.
          </>
        }
        confirmLabel="Excluir evento"
        loading={deleting}
        tone="error"
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
      />
    </PageContainer>
  );
}
