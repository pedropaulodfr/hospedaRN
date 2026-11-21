import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  DeleteOutlined,
  EditOutlined,
  ExpandMore,
  Rule,
} from '@mui/icons-material';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormActions,
  FormGrid,
  FormSection,
  FormSpan,
  PageContainer,
  PageHeader,
  PageLoading,
  SectionCard,
} from '../../components/common';
import { regrasApi, establishmentsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

interface Topico {
  id: string;
  label: string;
  valor?: string;
  ordem: number;
}

interface Secao {
  id: string;
  nome: string;
  ordem: number;
  topicos: Topico[];
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function EstRegras() {
  const { user } = useAuthStore();

  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [estabelecimentoId, setEstabelecimentoId] = useState<string>('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [dialogSecao, setDialogSecao] = useState(false);
  const [editingSecao, setEditingSecao] = useState<Secao | null>(null);
  const [secaoNome, setSecaoNome] = useState('');
  const [savingSecao, setSavingSecao] = useState(false);

  const [dialogTopico, setDialogTopico] = useState(false);
  const [editingTopico, setEditingTopico] = useState<Topico | null>(null);
  const [topicoSecaoId, setTopicoSecaoId] = useState('');
  const [topicoLabel, setTopicoLabel] = useState('');
  const [topicoValor, setTopicoValor] = useState('');
  const [savingTopico, setSavingTopico] = useState(false);

  const [secaoToDelete, setSecaoToDelete] = useState<Secao | null>(null);
  const [topicoToDelete, setTopicoToDelete] = useState<Topico | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const linkedId = (user as any)?.estabelecimentoVinculadoId;
      if (linkedId) {
        setEstabelecimentoId(linkedId);
        return;
      }
      try {
        const res = await establishmentsApi.getMy();
        const list = res.data.data || res.data || [];
        if (list.length > 0) {
          setEstabelecimentoId(list[0].id);
        }
      } catch {
        toast.error('Erro ao carregar estabelecimento');
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const load = async () => {
    if (!estabelecimentoId) return;
    try {
      setError(false);
      const res = await regrasApi.getByEstablishment(estabelecimentoId);
      const items = res.data.data || res.data || [];
      setSecoes(items);
      setExpanded(Object.fromEntries(items.map((s: Secao) => [s.id, true])));
    } catch {
      setError(true);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (estabelecimentoId) load(); }, [estabelecimentoId]);

  const openSecaoDialog = (secao?: Secao) => {
    setEditingSecao(secao || null);
    setSecaoNome(secao?.nome || '');
    setDialogSecao(true);
  };

  const saveSecao = async () => {
    if (!estabelecimentoId || !secaoNome.trim()) return;
    try {
      setSavingSecao(true);
      if (editingSecao) {
        await regrasApi.updateSecao(editingSecao.id, { nome: secaoNome.trim() });
        toast.success('Seção atualizada');
      } else {
        await regrasApi.createSecao(estabelecimentoId, { nome: secaoNome.trim() });
        toast.success('Seção criada');
      }
      setDialogSecao(false);
      load();
    } catch {
      toast.error('Erro ao salvar seção');
    } finally {
      setSavingSecao(false);
    }
  };

  const deleteSecao = async (id: string) => {
    try {
      setDeleting(true);
      await regrasApi.deleteSecao(id);
      toast.success('Seção removida');
      setSecaoToDelete(null);
      load();
    } catch {
      toast.error('Erro ao remover seção');
    } finally {
      setDeleting(false);
    }
  };

  const openTopicoDialog = (secaoId: string, topico?: Topico) => {
    setTopicoSecaoId(secaoId);
    setEditingTopico(topico || null);
    setTopicoLabel(topico?.label || '');
    setTopicoValor(topico?.valor || '');
    setDialogTopico(true);
  };

  const saveTopico = async () => {
    if (!topicoLabel.trim()) return;
    try {
      setSavingTopico(true);
      if (editingTopico) {
        await regrasApi.updateTopico(editingTopico.id, { label: topicoLabel.trim(), valor: topicoValor.trim() });
        toast.success('Tópico atualizado');
      } else {
        await regrasApi.createTopico(topicoSecaoId, { label: topicoLabel.trim(), valor: topicoValor.trim() });
        toast.success('Tópico criado');
      }
      setDialogTopico(false);
      load();
    } catch {
      toast.error('Erro ao salvar tópico');
    } finally {
      setSavingTopico(false);
    }
  };

  const deleteTopico = async (id: string) => {
    try {
      setDeleting(true);
      await regrasApi.deleteTopico(id);
      toast.success('Tópico removido');
      setTopicoToDelete(null);
      load();
    } catch {
      toast.error('Erro ao remover tópico');
    } finally {
      setDeleting(false);
    }
  };

  const moveSecao = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= secoes.length) return;
    const arr = [...secoes];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setSecoes(arr);
    try {
      await regrasApi.updateSecao(secoes[index].id, { ordem: newIndex });
      await regrasApi.updateSecao(secoes[newIndex].id, { ordem: index });
    } catch {
      toast.error('Erro ao reordenar');
      load();
    }
  };

  const moveTopico = async (secaoId: string, index: number, direction: -1 | 1) => {
    const secao = secoes.find(s => s.id === secaoId);
    if (!secao) return;
    const topicos = [...secao.topicos];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= topicos.length) return;
    [topicos[index], topicos[newIndex]] = [topicos[newIndex], topicos[index]];
    setSecoes(prev => prev.map(s => s.id === secaoId ? { ...s, topicos } : s));
    try {
      await regrasApi.updateTopico(topicos[index].id, { ordem: newIndex });
      await regrasApi.updateTopico(topicos[newIndex].id, { ordem: index });
    } catch {
      toast.error('Erro ao reordenar');
      load();
    }
  };

  const totalTopicos = useMemo(
    () => secoes.reduce((acc, secao) => acc + (secao.topicos?.length || 0), 0),
    [secoes],
  );

  if (loading) return <PageLoading label="Carregando regras do estabelecimento…" />;

  if (!estabelecimentoId) {
    return (
      <PageContainer maxWidth="reading">
        <PageHeader
          overline="Catálogo"
          title="Regras e informações"
          subtitle="Organize as políticas e informações do estabelecimento em seções e tópicos."
          icon={<Rule />}
        />
        <SectionCard>
          <EmptyState
            title="Nenhum estabelecimento encontrado"
            description="Vincule um estabelecimento à sua conta para cadastrar regras e informações."
            icon={<Rule />}
          />
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="reading">
      <PageHeader
        overline="Catálogo"
        title="Regras e informações"
        subtitle="Agrupe horários, políticas e regras da casa em seções. Cada tópico reúne um título e a descrição exibida ao hóspede."
        icon={<Rule />}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => openSecaoDialog()}>
            Nova seção
          </Button>
        }
      />

      {error ? (
        <SectionCard>
          <ErrorState
            title="Não foi possível carregar as regras"
            description="Ocorreu uma falha ao buscar as seções do estabelecimento. Tente novamente em instantes."
            onRetry={load}
          />
        </SectionCard>
      ) : secoes.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="Nenhuma seção de regras cadastrada"
            description="Comece criando uma seção, como Horários, Políticas ou Regras da casa, e adicione tópicos com os detalhes."
            icon={<Rule />}
            action={
              <Button variant="contained" startIcon={<Add />} onClick={() => openSecaoDialog()}>
                Criar primeira seção
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary">
              {plural(secoes.length, 'seção', 'seções')}
            </Typography>
            <Typography variant="body2" color="textDisabled" aria-hidden>
              ·
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {plural(totalTopicos, 'tópico', 'tópicos')}
            </Typography>
          </Box>

          {secoes.map((secao, secaoIndex) => {
            const isExpanded = Boolean(expanded[secao.id]);
            return (
              <Accordion
                key={secao.id}
                variant="outlined"
                expanded={isExpanded}
                onChange={() => setExpanded(p => ({ ...p, [secao.id]: !p[secao.id] }))}
                sx={{ borderRadius: 3, '&.Mui-expanded': { borderRadius: 3 } }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls={`secao-${secao.id}-conteudo`}
                  id={`secao-${secao.id}-cabecalho`}
                  sx={{ px: { xs: 1.5, sm: 2.5 }, minHeight: 64, '& .MuiAccordionSummary-content': { my: 1.25 } }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box
                      aria-hidden
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        typography: 'caption',
                        fontWeight: 700,
                      }}
                    >
                      {secaoIndex + 1}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600, display: 'block' }} noWrap>
                        {secao.nome}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" component="span">
                        {secao.topicos.length === 0
                          ? 'Nenhum tópico'
                          : plural(secao.topicos.length, 'tópico', 'tópicos')}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack
                    direction="row"
                    spacing={0.25}
                    sx={{ alignItems: 'center', mr: 0.5, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip title="Mover seção para cima">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Mover seção ${secao.nome} para cima`}
                          disabled={secaoIndex === 0}
                          onClick={(e) => { e.stopPropagation(); moveSecao(secaoIndex, -1); }}
                        >
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Mover seção para baixo">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Mover seção ${secao.nome} para baixo`}
                          disabled={secaoIndex === secoes.length - 1}
                          onClick={(e) => { e.stopPropagation(); moveSecao(secaoIndex, 1); }}
                        >
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Editar seção">
                      <IconButton
                        size="small"
                        aria-label={`Editar seção ${secao.nome}`}
                        onClick={(e) => { e.stopPropagation(); openSecaoDialog(secao); }}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir seção">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Excluir seção ${secao.nome}`}
                        onClick={(e) => { e.stopPropagation(); setSecaoToDelete(secao); }}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ px: { xs: 1.5, sm: 2.5 }, pt: 0, pb: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  {secao.topicos.length === 0 ? (
                    <Box sx={{ py: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">
                        Esta seção ainda não tem tópicos.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={0.5}>
                      {secao.topicos.map((topico, topicoIndex) => (
                        <Box
                          key={topico.id}
                          sx={{
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            justifyContent: 'space-between',
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            transition: 'background-color 120ms',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} component="p">
                              {topico.label}
                            </Typography>
                            {topico.valor && (
                              <Typography variant="body2" color="textSecondary" component="p">
                                {topico.valor}
                              </Typography>
                            )}
                          </Box>
                          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
                            <Tooltip title="Mover tópico para cima">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label={`Mover tópico ${topico.label} para cima`}
                                  disabled={topicoIndex === 0}
                                  onClick={() => moveTopico(secao.id, topicoIndex, -1)}
                                >
                                  <ArrowUpward fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Mover tópico para baixo">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label={`Mover tópico ${topico.label} para baixo`}
                                  disabled={topicoIndex === secao.topicos.length - 1}
                                  onClick={() => moveTopico(secao.id, topicoIndex, 1)}
                                >
                                  <ArrowDownward fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Editar tópico">
                              <IconButton
                                size="small"
                                aria-label={`Editar tópico ${topico.label}`}
                                onClick={() => openTopicoDialog(secao.id, topico)}
                              >
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Excluir tópico">
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Excluir tópico ${topico.label}`}
                                onClick={() => setTopicoToDelete(topico)}
                              >
                                <DeleteOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}

                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => openTopicoDialog(secao.id)}
                    sx={{ mt: 1.5 }}
                  >
                    Adicionar tópico
                  </Button>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      )}

      {/* Criar / editar seção */}
      <Dialog
        open={dialogSecao}
        onClose={() => { if (!savingSecao) setDialogSecao(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="h2">
          {editingSecao ? 'Editar seção' : 'Nova seção'}
        </DialogTitle>
        <DialogContent>
          <FormSection description="Use nomes curtos e reconhecíveis, como Horários, Políticas ou Regras da casa.">
            <FormGrid columns={1}>
              <TextField
                autoFocus
                label="Nome da seção"
                fullWidth
                required
                value={secaoNome}
                onChange={e => setSecaoNome(e.target.value)}
                placeholder="Ex.: Horários, Políticas, Regras da casa"
                helperText="Obrigatório. Aparece como título da seção na página do estabelecimento."
              />
            </FormGrid>
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button color="inherit" onClick={() => setDialogSecao(false)} disabled={savingSecao}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={saveSecao}
            disabled={!secaoNome.trim() || savingSecao}
          >
            {savingSecao ? 'Salvando…' : editingSecao ? 'Salvar alterações' : 'Criar seção'}
          </Button>
        </FormActions>
      </Dialog>

      {/* Criar / editar tópico */}
      <Dialog
        open={dialogTopico}
        onClose={() => { if (!savingTopico) setDialogTopico(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="h2">
          {editingTopico ? 'Editar tópico' : 'Novo tópico'}
        </DialogTitle>
        <DialogContent>
          <FormSection description="O título aparece em destaque e a descrição complementa o que o hóspede precisa saber.">
            <FormGrid columns={1}>
              <TextField
                autoFocus
                label="Título"
                fullWidth
                required
                value={topicoLabel}
                onChange={e => setTopicoLabel(e.target.value)}
                placeholder="Ex.: Check-in, Café da manhã"
              />
              <TextField
                label="Valor / descrição"
                fullWidth
                value={topicoValor}
                onChange={e => setTopicoValor(e.target.value)}
                placeholder="Ex.: a partir das 14h"
                multiline
                minRows={2}
              />
              <FormSpan span={1}>
                <Typography variant="caption" color="textSecondary">
                  Dica: descreva horários, restrições e condições de forma objetiva.
                </Typography>
              </FormSpan>
            </FormGrid>
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button color="inherit" onClick={() => setDialogTopico(false)} disabled={savingTopico}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={saveTopico}
            disabled={!topicoLabel.trim() || savingTopico}
          >
            {savingTopico ? 'Salvando…' : editingTopico ? 'Salvar alterações' : 'Criar tópico'}
          </Button>
        </FormActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(secaoToDelete)}
        title="Excluir seção"
        description={
          <>
            Excluir a seção <strong>{secaoToDelete?.nome}</strong> e todos os seus tópicos? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir seção"
        tone="error"
        loading={deleting}
        onConfirm={() => secaoToDelete && deleteSecao(secaoToDelete.id)}
        onClose={() => { if (!deleting) setSecaoToDelete(null); }}
      />

      <ConfirmDialog
        open={Boolean(topicoToDelete)}
        title="Excluir tópico"
        description={
          <>
            Excluir o tópico <strong>{topicoToDelete?.label}</strong>? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir tópico"
        tone="error"
        loading={deleting}
        onConfirm={() => topicoToDelete && deleteTopico(topicoToDelete.id)}
        onClose={() => { if (!deleting) setTopicoToDelete(null); }}
      />
    </PageContainer>
  );
}
