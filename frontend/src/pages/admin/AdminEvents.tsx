import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip,
  OutlinedInput,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Link as MuiLink,
  DialogContentText,
} from '@mui/material';
import { Add, Edit, Delete, CalendarToday, OpenInNew, WarningAmber } from '@mui/icons-material';
import { eventsApi, citiesApi } from '../../services/api';
import toast from 'react-hot-toast';

interface City {
  id: string;
  nome: string;
}

interface EventCity {
  cidade: City;
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
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, citiesRes] = await Promise.all([
        eventsApi.getAll(),
        citiesApi.getAll(true),
      ]);
      setEvents(eventsRes.data.data || []);
      setCities(citiesRes.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar eventos/cidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setSelectedEvent(null);
    setNome('');
    setDescricao('');
    setLinkOficial('');
    setDataInicio('');
    setDataFim('');
    setSelectedCityIds([]);
    setOpenDialog(true);
  };

  const handleOpenEdit = (evt: EventData) => {
    setSelectedEvent(evt);
    setNome(evt.nome);
    setDescricao(evt.descricao || '');
    setLinkOficial(evt.linkOficial || '');

    // Format ISO string to YYYY-MM-DD for textfield type date
    const startStr = evt.dataInicio ? new Date(evt.dataInicio).toISOString().split('T')[0] : '';
    const endStr = evt.dataFim ? new Date(evt.dataFim).toISOString().split('T')[0] : '';
    setDataInicio(startStr);
    setDataFim(endStr);

    const cityIds = evt.eventosCidades.map((ec) => ec.cidade.id);
    setSelectedCityIds(cityIds);
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

    try {
      setSaving(true);
      if (selectedEvent) {
        await eventsApi.update(selectedEvent.id, payload);
        toast.success('Evento atualizado com sucesso');
      } else {
        await eventsApi.create(payload);
        toast.success('Evento cadastrado com sucesso');
      }
      setOpenDialog(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar evento');
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
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir evento');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setEventToDelete(null);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Eventos da Região
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cadastre os grandes eventos regionais e vincule-os às cidades parceiras.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenAdd}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #FF7043, #FF5722)',
            boxShadow: '0 4px 14px 0 rgba(255, 112, 67, 0.3)',
          }}
        >
          Novo Evento
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper
          sx={{
            borderRadius: '20px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Nome do Evento</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Data</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Cidades Vinculadas</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Link Oficial</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Nenhum evento cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    <TableRow key={evt.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarToday sx={{ color: 'secondary.main', fontSize: 20 }} />
                          {evt.nome}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(evt.dataInicio).toLocaleDateString('pt-BR')} a{' '}
                        {new Date(evt.dataFim).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {evt.eventosCidades.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">Global (sem cidade)</Typography>
                          ) : (
                            evt.eventosCidades.map((ec) => (
                              <Chip key={ec.cidade.id} label={ec.cidade.nome} size="small" />
                            ))
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {evt.linkOficial ? (
                          <MuiLink href={evt.linkOficial} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            Site Oficial <OpenInNew fontSize="inherit" />
                          </MuiLink>
                        ) : (
                          <Typography variant="caption" color="text.secondary">Nenhum</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton onClick={() => handleOpenEdit(evt)} color="primary" size="small" sx={{ mr: 1 }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton onClick={() => handleDeleteClick(evt)} color="error" size="small">
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          {selectedEvent ? 'Editar Evento' : 'Cadastrar Novo Evento'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Nome do Evento"
            fullWidth
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Data de Início"
              type="date"
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <TextField
              label="Data de Término"
              type="date"
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </Box>

          <TextField
            label="Link Oficial (Ex: https://...)"
            fullWidth
            value={linkOficial}
            onChange={(e) => setLinkOficial(e.target.value)}
          />

          <FormControl fullWidth>
            <InputLabel>Cidades Vinculadas</InputLabel>
            <Select
              multiple
              value={selectedCityIds}
              onChange={(e) => setSelectedCityIds(e.target.value as string[])}
              input={<OutlinedInput label="Cidades Vinculadas" />}
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

          <TextField
            label="Descrição do Evento"
            multiline
            rows={3}
            fullWidth
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDialog(false)} disabled={saving} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #FF7043, #FF5722)',
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber sx={{ color: 'error.main' }} />
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deseja realmente excluir o evento <strong>{eventToDelete?.nome}</strong>? Esta ação é irreversível.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={handleDeleteCancel} disabled={deleting} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {deleting ? 'Excluindo...' : 'Sim, Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
