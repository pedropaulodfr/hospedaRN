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
  DialogContentText,
  TextField,
  Switch,
  CircularProgress,
  Tooltip,
  Avatar,
  Stack,
} from '@mui/material';
import { Add, Edit, Delete, LocationCity, WarningAmber } from '@mui/icons-material';
import { citiesApi, uploadsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface City {
  id: string;
  nome: string;
  estado: string;
  latitude: number;
  longitude: number;
  descricao?: string;
  ativo: boolean;
  fotoPerfil?: string;
  _count?: {
    estabelecimentos: number;
  };
}

const getPhotoUrl = (filename?: string) => {
  if (!filename) return '';
  return `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/cidades/${filename}`;
};

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  // Delete confirmation dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [estado, setEstado] = useState('RN');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchCities = async () => {
    try {
      setLoading(true);
      const res = await citiesApi.getAll();
      setCities(res.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar cidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const handleOpenAdd = () => {
    setSelectedCity(null);
    setNome('');
    setEstado('RN');
    setLatitude('-5.7945'); // Default Natal coordinates
    setLongitude('-35.2110');
    setDescricao('');
    setFotoPerfil('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (city: City) => {
    setSelectedCity(city);
    setNome(city.nome);
    setEstado(city.estado);
    setLatitude(city.latitude.toString());
    setLongitude(city.longitude.toString());
    setDescricao(city.descricao || '');
    setFotoPerfil(city.fotoPerfil || '');
    setOpenDialog(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await uploadsApi.uploadImage('cidades', file);
      const s3Key = res.data.data?.s3Key || res.data.s3Key;
      const filename = s3Key.split('/').pop() || '';
      setFotoPerfil(filename);
      toast.success('Foto da cidade enviada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fazer upload da foto da cidade');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!nome || !latitude || !longitude) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      nome,
      estado,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      descricao,
      fotoPerfil: fotoPerfil || undefined,
    };

    try {
      setSaving(true);
      if (selectedCity) {
        await citiesApi.update(selectedCity.id, payload);
        toast.success('Cidade atualizada com sucesso');
      } else {
        await citiesApi.create(payload);
        toast.success('Cidade cadastrada com sucesso');
      }
      setOpenDialog(false);
      fetchCities();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cidade');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (city: City) => {
    try {
      await citiesApi.update(city.id, { ativo: !city.ativo });
      toast.success(`Cidade ${!city.ativo ? 'ativada' : 'inativada'} com sucesso`);
      fetchCities();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status da cidade');
    }
  };

  const handleDeleteClick = (city: City) => {
    setCityToDelete(city);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cityToDelete) return;
    try {
      setDeleting(true);
      await citiesApi.delete(cityToDelete.id);
      toast.success('Cidade excluída com sucesso');
      setConfirmDeleteOpen(false);
      setCityToDelete(null);
      fetchCities();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao excluir cidade. Verifique se existem estabelecimentos associados.';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setCityToDelete(null);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Cidades Cadastradas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie as cidades atendidas pelo sistema, suas coordenadas e descrições.
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
            background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            boxShadow: '0 4px 14px 0 rgba(0, 151, 167, 0.3)',
          }}
        >
          Nova Cidade
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
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Geolocalização</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Estabelecimentos</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ativo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Nenhuma cidade cadastrada ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  cities.map((city) => (
                    <TableRow key={city.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={getPhotoUrl(city.fotoPerfil)}
                            sx={{ width: 32, height: 32, bgcolor: 'rgba(0,151,167,0.08)' }}
                          >
                            <LocationCity sx={{ fontSize: 18, color: 'primary.main' }} />
                          </Avatar>
                          {city.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{city.estado}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {parseFloat(city.latitude.toString()).toFixed(4)}, {parseFloat(city.longitude.toString()).toFixed(4)}
                      </TableCell>
                      <TableCell align="center">{city._count?.estabelecimentos ?? 0}</TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={city.ativo}
                          onChange={() => handleToggleActive(city)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton onClick={() => handleOpenEdit(city)} color="primary" size="small" sx={{ mr: 1 }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton onClick={() => handleDeleteClick(city)} color="error" size="small">
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
          {selectedCity ? 'Editar Cidade' : 'Cadastrar Nova Cidade'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {/* Foto da Cidade */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={getPhotoUrl(fotoPerfil)}
                sx={{ width: 100, height: 100, border: '2px solid', borderColor: 'primary.main', bgcolor: 'rgba(0,151,167,0.08)' }}
              >
                <LocationCity sx={{ fontSize: 50, color: 'primary.main' }} />
              </Avatar>
              {uploadingImage && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.7)',
                    borderRadius: '50%',
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                component="label"
                size="small"
                disabled={uploadingImage}
                sx={{ textTransform: 'none', borderRadius: '8px' }}
              >
                {fotoPerfil ? 'Alterar Foto' : 'Adicionar Foto'}
                <input type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
              </Button>
              {fotoPerfil && (
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  onClick={() => setFotoPerfil('')}
                  sx={{ textTransform: 'none' }}
                >
                  Remover
                </Button>
              )}
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Nome da Cidade"
              fullWidth
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Natal"
            />
            <TextField
              label="UF"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { maxLength: 2 } }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Latitude"
              type="number"
              fullWidth
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="Ex: -5.7945"
            />
            <TextField
              label="Longitude"
              type="number"
              fullWidth
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="Ex: -35.2110"
            />
          </Box>
          <TextField
            label="Descrição / Pontos Fortes"
            multiline
            rows={3}
            fullWidth
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Conhecida pelas belas dunas e praias, polo turístico do Rio Grande do Norte..."
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
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
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
            Deseja realmente excluir a cidade <strong>{cityToDelete?.nome}</strong>? Esta ação é irreversível e não poderá ser desfeita.
          </DialogContentText>
          {(cityToDelete?._count?.estabelecimentos ?? 0) > 0 && (
            <DialogContentText sx={{ mt: 1.5, color: 'warning.main', fontWeight: 500 }}>
              ⚠️ Esta cidade possui {cityToDelete?._count?.estabelecimentos} estabelecimento(s) vinculado(s). A exclusão pode falhar.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
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
