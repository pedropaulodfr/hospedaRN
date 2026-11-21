import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Switch,
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
import { alpha } from '@mui/material/styles';
import { Add, Delete, Edit, LocationCity, PhotoCamera } from '@mui/icons-material';
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
  PageContainer,
  PageHeader,
  SearchField,
  SectionCard,
  StatusChip,
  TableSkeleton,
} from '../../components/common';
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

const coordinates = (city: City) => {
  const lat = Number(city.latitude);
  const lng = Number(city.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Coordenadas não informadas';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
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
      setError(false);
      const res = await citiesApi.getAll();
      setCities(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
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
    setLatitude('-5.7945'); // Coordenadas padrão de Natal/RN
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
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        'Erro ao excluir cidade. Verifique se existem estabelecimentos associados.';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setCityToDelete(null);
  };

  const term = search.trim().toLowerCase();
  const filteredCities = term
    ? cities.filter(
        (city) =>
          city.nome.toLowerCase().includes(term) ||
          (city.estado || '').toLowerCase().includes(term),
      )
    : cities;
  const linkedEstablishments = cityToDelete?._count?.estabelecimentos ?? 0;

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        overline="Catálogo"
        title="Cidades"
        subtitle="Gerencie as cidades atendidas pela plataforma, suas coordenadas e descrições."
        icon={<LocationCity />}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
            Nova cidade
          </Button>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cidade ou UF"
            width={320}
          />
        </DataToolbarGroup>
        <Typography variant="caption" color="textSecondary">
          {filteredCities.length} de {cities.length} {cities.length === 1 ? 'cidade' : 'cidades'}
        </Typography>
      </DataToolbar>

      <SectionCard noPadding>
        {loading ? (
          <Box sx={{ p: 2.5 }}>
            <TableSkeleton rows={6} columns={4} />
          </Box>
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar as cidades"
            description="Ocorreu uma falha ao buscar as cidades cadastradas."
            onRetry={fetchCities}
          />
        ) : cities.length === 0 ? (
          <EmptyState
            icon={<LocationCity />}
            title="Nenhuma cidade cadastrada"
            description="Cadastre a primeira cidade atendida para vincular estabelecimentos e eventos."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
                Nova cidade
              </Button>
            }
          />
        ) : filteredCities.length === 0 ? (
          <EmptyState
            icon={EmptySearchIcon}
            title="Nenhuma cidade encontrada"
            description="Ajuste a busca para encontrar a cidade desejada."
            action={
              <Button variant="outlined" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            }
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cidade</TableCell>
                  <TableCell align="right">Estabelecimentos</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCities.map((city) => (
                  <TableRow key={city.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={getPhotoUrl(city.fotoPerfil)}
                          alt={`Foto da cidade de ${city.nome}`}
                          sx={{ width: 36, height: 36, fontSize: '0.875rem' }}
                        >
                          <LocationCity sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {city.nome}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {city.estado} · {coordinates(city)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {city._count?.estabelecimentos ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <StatusChip status={city.ativo ? 'ATIVO' : 'INATIVO'} />
                        <Switch
                          checked={city.ativo}
                          onChange={() => handleToggleActive(city)}
                          color="primary"
                          size="small"
                          slotProps={{
                            input: {
                              'aria-label': `${city.ativo ? 'Inativar' : 'Ativar'} cidade ${city.nome}`,
                            },
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar cidade ${city.nome}`}
                            onClick={() => handleOpenEdit(city)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            aria-label={`Excluir cidade ${city.nome}`}
                            color="error"
                            onClick={() => handleDeleteClick(city)}
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
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedCity ? 'Editar cidade' : 'Cadastrar cidade'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2.5 }}>
            A foto e a descrição aparecem para os hóspedes na busca por destinos.
          </Typography>

          <FormSection title="Foto de capa">
            <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={getPhotoUrl(fotoPerfil)}
                  alt={nome ? `Foto da cidade de ${nome}` : 'Prévia da foto da cidade'}
                  variant="rounded"
                  sx={{ width: 96, height: 96, fontSize: '2rem' }}
                >
                  <LocationCity sx={{ fontSize: 44 }} />
                </Avatar>
                {uploadingImage && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      bgcolor: (t) => alpha(t.palette.background.paper, 0.72),
                    }}
                  >
                    <CircularProgress size={24} />
                  </Box>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<PhotoCamera />}
                  disabled={uploadingImage}
                >
                  {fotoPerfil ? 'Alterar foto' : 'Adicionar foto'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    aria-label="Selecionar foto da cidade"
                    onChange={handlePhotoUpload}
                  />
                </Button>
                {fotoPerfil && (
                  <Button
                    variant="text"
                    color="error"
                    size="small"
                    onClick={() => setFotoPerfil('')}
                  >
                    Remover
                  </Button>
                )}
              </Stack>
            </Stack>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <FormSection
            title="Dados da cidade"
            description="Nome, UF e coordenadas são usados na busca e no mapa."
          >
            <FormGrid columns={3}>
              <FormSpan span={3}>
                <TextField
                  label="Nome da cidade"
                  fullWidth
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Natal"
                />
              </FormSpan>
              <TextField
                label="UF"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 2, 'aria-label': 'UF da cidade' } }}
              />
              <TextField
                label="Latitude"
                type="number"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Ex: -5.7945"
              />
              <TextField
                label="Longitude"
                type="number"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Ex: -35.2110"
              />
              <FormSpan span={3}>
                <TextField
                  label="Descrição e pontos fortes"
                  multiline
                  rows={3}
                  fullWidth
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Conhecida pelas dunas e praias, polo turístico do Rio Grande do Norte."
                />
              </FormSpan>
            </FormGrid>
          </FormSection>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} loading={saving}>
            {selectedCity ? 'Salvar alterações' : 'Cadastrar cidade'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir cidade"
        description={
          <>
            Deseja excluir a cidade <strong>{cityToDelete?.nome}</strong>? Esta ação não pode ser
            desfeita.
          </>
        }
        confirmLabel="Excluir cidade"
        loading={deleting}
        tone="error"
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
      >
        {linkedEstablishments > 0 && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: (t) => alpha(t.palette.warning.main, 0.35),
              bgcolor: (t) => alpha(t.palette.warning.main, 0.08),
              color: 'text.primary',
            }}
          >
            <Typography variant="body2">
              Esta cidade possui {linkedEstablishments}{' '}
              {linkedEstablishments === 1
                ? 'estabelecimento vinculado'
                : 'estabelecimentos vinculados'}
              . A exclusão pode falhar.
            </Typography>
          </Box>
        )}
      </ConfirmDialog>
    </PageContainer>
  );
}
