import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, List, ListItem, ListItemText, ListItemSecondaryAction,
  Collapse,
} from '@mui/material';
import {
  Add, Edit, Delete, ExpandMore, ExpandLess, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
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

export default function EstRegras() {
  const { user } = useAuthStore();

  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [loading, setLoading] = useState(true);
  const [estabelecimentoId, setEstabelecimentoId] = useState<string>('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [dialogSecao, setDialogSecao] = useState(false);
  const [editingSecao, setEditingSecao] = useState<Secao | null>(null);
  const [secaoNome, setSecaoNome] = useState('');

  const [dialogTopico, setDialogTopico] = useState(false);
  const [editingTopico, setEditingTopico] = useState<Topico | null>(null);
  const [topicoSecaoId, setTopicoSecaoId] = useState('');
  const [topicoLabel, setTopicoLabel] = useState('');
  const [topicoValor, setTopicoValor] = useState('');

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
      const { data } = await regrasApi.getByEstablishment(estabelecimentoId);
      setSecoes(data);
      setExpanded(Object.fromEntries(data.map((s: Secao) => [s.id, true])));
    } catch {
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
    }
  };

  const deleteSecao = async (id: string) => {
    if (!confirm('Excluir esta seção e todos os seus tópicos?')) return;
    try {
      await regrasApi.deleteSecao(id);
      toast.success('Seção removida');
      load();
    } catch {
      toast.error('Erro ao remover seção');
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
    }
  };

  const deleteTopico = async (id: string) => {
    if (!confirm('Excluir este tópico?')) return;
    try {
      await regrasApi.deleteTopico(id);
      toast.success('Tópico removido');
      load();
    } catch {
      toast.error('Erro ao remover tópico');
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

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  if (!estabelecimentoId) {
    return (
      <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Regras e Informações</Typography>
        <Paper sx={{ p: 4, mt: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">Nenhum estabelecimento encontrado.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Regras e Informações</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => openSecaoDialog()}>
          Nova Seção
        </Button>
      </Box>

      {secoes.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Nenhuma seção de regras cadastrada.</Typography>
        </Paper>
      )}

      {secoes.map((secao, secaoIndex) => (
        <Paper key={secao.id} sx={{ mb: 2, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, bgcolor: 'action.hover' }}>
            <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [secao.id]: !p[secao.id] }))}>
              {expanded[secao.id] ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
            <Typography sx={{ fontWeight: 600, flex: 1, ml: 1 }}>{secao.nome}</Typography>
            <IconButton size="small" disabled={secaoIndex === 0} onClick={() => moveSecao(secaoIndex, -1)}>
              <ArrowUpward fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={secaoIndex === secoes.length - 1} onClick={() => moveSecao(secaoIndex, 1)}>
              <ArrowDownward fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => openSecaoDialog(secao)}><Edit fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => deleteSecao(secao.id)}><Delete fontSize="small" /></IconButton>
          </Box>
          <Collapse in={expanded[secao.id]}>
            <List dense disablePadding>
              {secao.topicos.map((topico, topicoIndex) => (
                <ListItem key={topico.id} sx={{ pl: 4, pr: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <ListItemText
                    primary={topico.label}
                    secondary={topico.valor}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', gap: 0 }}>
                    <IconButton size="small" disabled={topicoIndex === 0} onClick={() => moveTopico(secao.id, topicoIndex, -1)}>
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={topicoIndex === secao.topicos.length - 1} onClick={() => moveTopico(secao.id, topicoIndex, 1)}>
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openTopicoDialog(secao.id, topico)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteTopico(topico.id)}><Delete fontSize="small" /></IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Box sx={{ p: 1, pl: 4 }}>
              <Button size="small" startIcon={<Add />} onClick={() => openTopicoDialog(secao.id)}>
                Adicionar Tópico
              </Button>
            </Box>
          </Collapse>
        </Paper>
      ))}

      <Dialog open={dialogSecao} onClose={() => setDialogSecao(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSecao ? 'Editar Seção' : 'Nova Seção'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Nome da seção"
            fullWidth
            value={secaoNome}
            onChange={e => setSecaoNome(e.target.value)}
            sx={{ mt: 1 }}
            placeholder="Ex: Horários, Políticas, Regras da Casa"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogSecao(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveSecao}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogTopico} onClose={() => setDialogTopico(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTopico ? 'Editar Tópico' : 'Novo Tópico'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Título"
            fullWidth
            value={topicoLabel}
            onChange={e => setTopicoLabel(e.target.value)}
            sx={{ mt: 1 }}
            placeholder="Ex: Check-in, Café da manhã"
          />
          <TextField
            label="Valor / Descrição"
            fullWidth
            value={topicoValor}
            onChange={e => setTopicoValor(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Ex: a partir das 14:00h"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogTopico(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveTopico}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
