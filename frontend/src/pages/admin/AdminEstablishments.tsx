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
  Switch,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Divider,
  Grid,
  DialogContentText,
  Avatar,
} from '@mui/material';
import { Add, Visibility, Delete, Refresh, Business, WarningAmber, Edit } from '@mui/icons-material';
import { establishmentsApi, citiesApi, amenitiesApi, uploadsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface City {
  id: string;
  nome: string;
}

interface Amenity {
  id: string;
  nome: string;
}

interface Establishment {
  id: string;
  nome: string;
  descricao?: string;
  contato?: string;
  emailContato?: string;
  website?: string;
  endereco?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  ativo: boolean;
  cidade: { id: string; nome: string };
  proprietario: { id: string; nome: string; email: string };
  comodidades: Array<{ comodidade: { id: string; nome: string } }>;
  fotoPerfil?: string;
}

const getPhotoUrl = (filename?: string) => {
  if (!filename) return '';
  return `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/estabelecimentos/${filename}`;
};

export default function AdminEstablishments() {
  const [loading, setLoading] = useState(true);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  // Filtering tabs: 0 = Todos, 1 = Inativos
  const [activeTab, setActiveTab] = useState(0);

  // Dialogs
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editEstId, setEditEstId] = useState<string | null>(null);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedEst, setSelectedEst] = useState<Establishment | null>(null);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [estToDelete, setEstToDelete] = useState<Establishment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states for Create
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contato, setContato] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [website, setWebsite] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cep, setCep] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchCitiesAndAmenities = async () => {
    try {
      const [citiesRes, amenitiesRes] = await Promise.all([
        citiesApi.getAll(true),
        amenitiesApi.getAll(),
      ]);
      setCities(citiesRes.data.data || []);
      setAmenities(amenitiesRes.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar cidades/comodidades:', error);
    }
  };

  const fetchEstablishments = async () => {
    try {
      setLoading(true);
      const params: any = { adminView: true };

      // Map tabs to query parameters
      if (activeTab === 1) {
        params.ativo = false;
      }

      const res = await establishmentsApi.getAll(params);
      setEstablishments(res.data?.data?.data || res.data?.data || res.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar estabelecimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCitiesAndAmenities();
  }, []);

  useEffect(() => {
    fetchEstablishments();
  }, [activeTab]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditEstId(null);
    setNome('');
    setDescricao('');
    setContato('');
    setEmailContato('');
    setWebsite('');
    setEndereco('');
    setCep('');
    setLatitude('');
    setLongitude('');
    setCidadeId('');
    setSelectedAmenityIds([]);
    setFotoPerfil('');
    setOpenAddDialog(true);
  };

  const handleOpenEdit = (est: Establishment) => {
    setIsEditMode(true);
    setEditEstId(est.id);
    setNome(est.nome);
    setDescricao(est.descricao || '');
    setContato(est.contato || '');
    setEmailContato(est.emailContato || '');
    setWebsite(est.website || '');
    setEndereco(est.endereco || '');
    setCep(est.cep || '');
    setLatitude(est.latitude ? est.latitude.toString() : '');
    setLongitude(est.longitude ? est.longitude.toString() : '');
    setCidadeId(est.cidade?.id || '');
    setSelectedAmenityIds(est.comodidades.map(c => c.comodidade.id));
    setFotoPerfil(est.fotoPerfil || '');
    setOpenAddDialog(true);
  };

  const handleOpenDetails = (est: Establishment) => {
    setSelectedEst(est);
    setOpenDetailDialog(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await uploadsApi.uploadImage('estabelecimentos', file);
      const s3Key = res.data.data?.s3Key || res.data.s3Key;
      const filename = s3Key.split('/').pop() || '';
      setFotoPerfil(filename);
      toast.success('Foto de perfil enviada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fazer upload da foto de perfil');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!nome || !emailContato || !cidadeId) {
      toast.error('Preencha os campos obrigatórios (Nome, E-mail e Cidade)');
      return;
    }

    const payload = {
      nome,
      descricao,
      contato,
      emailContato,
      website,
      endereco,
      cep,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      cidadeId,
      amenityIds: selectedAmenityIds,
      fotoPerfil: fotoPerfil || undefined,
    };

    try {
      setSaving(true);
      if (isEditMode && editEstId) {
        await establishmentsApi.update(editEstId, payload);
        toast.success('Estabelecimento atualizado com sucesso!');
      } else {
        await establishmentsApi.create(payload);
        toast.success('Estabelecimento cadastrado! E-mail de boas-vindas e ativação enviado.');
      }
      setOpenAddDialog(false);
      fetchEstablishments();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || (isEditMode ? 'Erro ao atualizar' : 'Erro ao cadastrar estabelecimento');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (est: Establishment) => {
    try {
      await establishmentsApi.toggleActive(est.id);
      toast.success(`Estabelecimento ${!est.ativo ? 'ativado' : 'bloqueado'} com sucesso`);
      fetchEstablishments();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status do estabelecimento');
    }
  };

  const handleDeleteClick = (est: Establishment) => {
    setEstToDelete(est);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!estToDelete) return;
    try {
      setDeleting(true);
      await establishmentsApi.delete(estToDelete.id);
      toast.success('Estabelecimento excluído com sucesso');
      setConfirmDeleteOpen(false);
      setEstToDelete(null);
      fetchEstablishments();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao excluir estabelecimento';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setEstToDelete(null);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Estabelecimentos Cadastrados
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Ativação, gerenciamento e exclusão de hospedagens parceiras.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={fetchEstablishments}
            startIcon={<Refresh />}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
          >
            Atualizar
          </Button>
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
            Novo Estabelecimento
          </Button>
        </Stack>
      </Box>

      {/* Tabs Filter */}
      <Paper sx={{ mb: 3, borderRadius: '12px', overflow: 'hidden' }} elevation={0} variant="outlined">
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Todos" sx={{ fontWeight: 600, px: 3 }} />
          <Tab label="Inativos" sx={{ fontWeight: 600, px: 3 }} />
        </Tabs>
      </Paper>

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
                  <TableCell sx={{ fontWeight: 600 }}>Cidade</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>E-mail de Contato</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Proprietário</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ativo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {establishments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Nenhum estabelecimento encontrado nesta categoria.
                    </TableCell>
                  </TableRow>
                ) : (
                  establishments.map((est) => (
                    <TableRow key={est.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={getPhotoUrl(est.fotoPerfil)}
                            sx={{ width: 32, height: 32, bgcolor: 'rgba(0,151,167,0.08)' }}
                          >
                            <Business sx={{ fontSize: 18, color: 'primary.main' }} />
                          </Avatar>
                          {est.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{est.cidade?.nome || 'N/A'}</TableCell>
                      <TableCell>{est.emailContato || 'Não cadastrado'}</TableCell>
                      <TableCell>
                        {est.proprietario ? (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {est.proprietario.nome}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {est.proprietario.email}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="error">
                            Sem proprietário
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={est.ativo}
                          onChange={() => handleToggleActive(est)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                          <Tooltip title="Editar">
                            <IconButton onClick={() => handleOpenEdit(est)} color="secondary" size="small">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Detalhes">
                            <IconButton onClick={() => handleOpenDetails(est)} color="primary" size="small">
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton onClick={() => handleDeleteClick(est)} color="error" size="small">
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Add Establishment Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          {isEditMode ? 'Editar Estabelecimento' : 'Cadastrar Novo Estabelecimento'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          {!isEditMode && (
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
              * Ao salvar, a conta do proprietário será criada de forma automatizada se ainda não existir no sistema, vinculada ao E-mail de Contato.
            </Typography>
          )}

          <Grid container spacing={2} key={editEstId || 'new'} sx={{ mt: 0 }}>
            {/* Foto de Perfil */}
            <Grid size={{ xs: 12 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={getPhotoUrl(fotoPerfil)}
                  sx={{ width: 100, height: 100, border: '2px solid', borderColor: 'primary.main', bgcolor: 'rgba(0,151,167,0.08)' }}
                >
                  <Business sx={{ fontSize: 50, color: 'primary.main' }} />
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
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Nome do Estabelecimento"
                fullWidth
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="E-mail de Contato (Login do Proprietário)"
                type="email"
                fullWidth
                required
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Telefone / Contato"
                fullWidth
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="Ex: 84999999999"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Website (opcional)"
                fullWidth
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Endereço Completo"
                fullWidth
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="CEP"
                fullWidth
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Latitude (opcional)"
                type="number"
                fullWidth
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Longitude (opcional)"
                type="number"
                fullWidth
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Cidade</InputLabel>
                <Select
                  value={cidadeId}
                  onChange={(e) => setCidadeId(e.target.value)}
                  label="Cidade"
                >
                  {cities.map((city) => (
                    <MenuItem key={city.id} value={city.id}>
                      {city.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Descrição"
                multiline
                rows={3}
                fullWidth
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </Grid>

            {/* Amenities Select */}
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Comodidades / Vantagens Globais</InputLabel>
                <Select
                  multiple
                  value={selectedAmenityIds}
                  onChange={(e) => setSelectedAmenityIds(e.target.value as string[])}
                  input={<OutlinedInput label="Comodidades / Vantagens Globais" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const amenity = amenities.find((a) => a.id === value);
                        return <Chip key={value} label={amenity?.nome || value} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {amenities.map((amenity) => (
                    <MenuItem key={amenity.id} value={amenity.id}>
                      <Checkbox checked={selectedAmenityIds.indexOf(amenity.id) > -1} />
                      <ListItemText primary={amenity.nome} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={saving} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : (isEditMode ? 'Salvar Alterações' : 'Cadastrar Estabelecimento')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Establishment Dialog */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Detalhes do Estabelecimento
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {selectedEst && (
            <Stack spacing={2}>
              {selectedEst.fotoPerfil && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                  <Avatar
                    src={getPhotoUrl(selectedEst.fotoPerfil)}
                    variant="rounded"
                    sx={{ width: 120, height: 120, border: '1px solid', borderColor: 'divider' }}
                  />
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Nome do Estabelecimento</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedEst.nome}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Cidade Vinculada</Typography>
                <Typography variant="body1">{selectedEst.cidade?.nome}</Typography>
              </Box>

              {selectedEst.descricao && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Descrição</Typography>
                  <Typography variant="body2">{selectedEst.descricao}</Typography>
                </Box>
              )}

              <Divider />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Dados de Contato & Acesso
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">E-mail Comercial</Typography>
                  <Typography variant="body2">{selectedEst.emailContato || 'Não informado'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Telefone</Typography>
                  <Typography variant="body2">{selectedEst.contato || 'Não informado'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Website</Typography>
                  <Typography variant="body2">{selectedEst.website || 'Não informado'}</Typography>
                </Grid>
              </Grid>

              <Divider />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Endereço & Localização
              </Typography>

              <Box>
                <Typography variant="caption" color="text.secondary">Endereço</Typography>
                <Typography variant="body2">{selectedEst.endereco || 'Não informado'}</Typography>
                <Typography variant="body2" color="text.secondary">CEP: {selectedEst.cep || 'N/A'}</Typography>
              </Box>

              {selectedEst.latitude && selectedEst.longitude && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Coordenadas Geográficas</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    Lat: {selectedEst.latitude} | Lng: {selectedEst.longitude}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Comodidades Vinculadas
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedEst.comodidades.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">Nenhuma comodidade global cadastrada.</Typography>
                ) : (
                  selectedEst.comodidades.map((item) => (
                    <Chip key={item.comodidade.id} label={item.comodidade.nome} size="small" />
                  ))
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDetailDialog(false)} variant="contained" sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>
            Fechar
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
            Deseja realmente excluir o estabelecimento <strong>{estToDelete?.nome}</strong>? Esta ação é irreversível.
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
