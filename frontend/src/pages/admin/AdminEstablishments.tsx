import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add,
  Business,
  Delete,
  Edit,
  PhotoCamera,
  Refresh,
  Visibility,
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
  InfoGrid,
  InfoItem,
  ModoPagamentoChip,
  PageContainer,
  PageHeader,
  SearchField,
  SectionCard,
  StatusChip,
  TableSkeleton,
} from '../../components/common';
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
  modoPagamento?: 'PADRAO' | 'MERCADO_PAGO';
  cidade: { id: string; nome: string };
  proprietario: { id: string; nome: string; email: string };
  comodidades: Array<{ comodidade: { id: string; nome: string } }>;
  fotoPerfil?: string;
}

const getPhotoUrl = (filename?: string) => {
  if (!filename) return '';
  return `https://hospedarn-bucket.s3.us-east-2.amazonaws.com/estabelecimentos/${filename}`;
};

const coordinates = (est: Establishment) => {
  if (est.latitude == null || est.longitude == null) return 'Não informadas';
  return `${est.latitude}, ${est.longitude}`;
};

export default function AdminEstablishments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  // Busca e filtros locais (a aba recarrega via API)
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');

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
  const [modoPagamento, setModoPagamento] = useState<'PADRAO' | 'MERCADO_PAGO'>('PADRAO');
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
    } catch (err) {
      console.error('Erro ao carregar cidades/comodidades:', err);
    }
  };

  const fetchEstablishments = async () => {
    try {
      setLoading(true);
      setError(false);
      const params: any = { adminView: true };

      // Map tabs to query parameters
      if (activeTab === 1) {
        params.ativo = false;
      }

      const res = await establishmentsApi.getAll(params);
      setEstablishments(res.data?.data?.data || res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
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
    setModoPagamento('PADRAO');
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
    setSelectedAmenityIds(est.comodidades.map((c) => c.comodidade.id));
    setModoPagamento(est.modoPagamento || 'PADRAO');
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
    } catch (err) {
      console.error(err);
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
      modoPagamento,
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
    } catch (err: any) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        (isEditMode ? 'Erro ao atualizar' : 'Erro ao cadastrar estabelecimento');
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
    } catch (err) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erro ao excluir estabelecimento';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setEstToDelete(null);
  };

  const term = search.trim().toLowerCase();
  const cityOptions = Array.from(
    new Map(
      establishments
        .filter((est) => est.cidade?.id)
        .map((est) => [est.cidade.id, est.cidade.nome] as const),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

  const filteredEstablishments = establishments.filter((est) => {
    const matchesCity = cityFilter === 'all' || est.cidade?.id === cityFilter;
    if (!matchesCity) return false;
    if (!term) return true;
    return (
      est.nome.toLowerCase().includes(term) ||
      (est.cidade?.nome || '').toLowerCase().includes(term) ||
      (est.proprietario?.nome || '').toLowerCase().includes(term) ||
      (est.proprietario?.email || '').toLowerCase().includes(term) ||
      (est.emailContato || '').toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Catálogo"
        title="Estabelecimentos"
        subtitle="Ativação, gerenciamento e exclusão das hospedagens parceiras da plataforma."
        icon={<Business />}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchEstablishments}
              disabled={loading}
            >
              Atualizar
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
              Novo estabelecimento
            </Button>
          </>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, cidade ou proprietário"
            width={340}
          />
          <TextField
            select
            size="small"
            label="Cidade"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            sx={{ minWidth: 180, maxWidth: 240 }}
          >
            <MenuItem value="all">Todas as cidades</MenuItem>
            {cityOptions.map(([id, nome]) => (
              <MenuItem key={id} value={id}>
                {nome}
              </MenuItem>
            ))}
          </TextField>
        </DataToolbarGroup>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={activeTab}
          onChange={(_, value) => {
            if (value !== null) setActiveTab(value);
          }}
          aria-label="Filtrar estabelecimentos por status"
        >
          <ToggleButton value={0} aria-label="Mostrar todos os estabelecimentos">
            Todos
          </ToggleButton>
          <ToggleButton value={1} aria-label="Mostrar apenas estabelecimentos inativos">
            Inativos
          </ToggleButton>
        </ToggleButtonGroup>
      </DataToolbar>

      <SectionCard noPadding>
        {loading ? (
          <Box sx={{ p: 2.5 }}>
            <TableSkeleton rows={7} columns={6} />
          </Box>
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar os estabelecimentos"
            description="Ocorreu uma falha ao buscar os estabelecimentos cadastrados."
            onRetry={fetchEstablishments}
          />
        ) : establishments.length === 0 ? (
          <EmptyState
            icon={<Business />}
            title={
              activeTab === 1
                ? 'Nenhum estabelecimento inativo'
                : 'Nenhum estabelecimento cadastrado'
            }
            description={
              activeTab === 1
                ? 'Todos os estabelecimentos da plataforma estão ativos no momento.'
                : 'Cadastre a primeira hospedagem parceira para começar a receber reservas.'
            }
            action={
              activeTab === 0 ? (
                <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
                  Novo estabelecimento
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => setActiveTab(0)}>
                  Ver todos
                </Button>
              )
            }
          />
        ) : filteredEstablishments.length === 0 ? (
          <EmptyState
            icon={EmptySearchIcon}
            title="Nenhum estabelecimento encontrado"
            description="Ajuste a busca ou o filtro de cidade para encontrar o estabelecimento desejado."
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch('');
                  setCityFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Estabelecimento</TableCell>
                  <TableCell>Cidade</TableCell>
                  <TableCell>Proprietário</TableCell>
                  <TableCell>Pagamento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEstablishments.map((est) => (
                  <TableRow key={est.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={getPhotoUrl(est.fotoPerfil)}
                          alt={`Foto de ${est.nome}`}
                          variant="rounded"
                          sx={{ width: 38, height: 38, fontSize: '0.875rem' }}
                        >
                          <Business sx={{ fontSize: 20 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {est.nome}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {est.emailContato || 'E-mail de contato não cadastrado'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{est.cidade?.nome || '—'}</TableCell>
                    <TableCell>
                      {est.proprietario ? (
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                            {est.proprietario.nome}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {est.proprietario.email}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="error">
                          Sem proprietário
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <ModoPagamentoChip modo={est.modoPagamento || 'PADRAO'} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <StatusChip status={est.ativo ? 'ATIVO' : 'INATIVO'} />
                        <Switch
                          size="small"
                          checked={est.ativo}
                          onChange={() => handleToggleActive(est)}
                          color="primary"
                          slotProps={{
                            input: {
                              'aria-label': `${est.ativo ? 'Bloquear' : 'Ativar'} estabelecimento ${est.nome}`,
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
                            aria-label={`Editar estabelecimento ${est.nome}`}
                            onClick={() => handleOpenEdit(est)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Detalhes">
                          <IconButton
                            size="small"
                            aria-label={`Ver detalhes de ${est.nome}`}
                            onClick={() => handleOpenDetails(est)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Excluir estabelecimento ${est.nome}`}
                            onClick={() => handleDeleteClick(est)}
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
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditMode ? 'Editar estabelecimento' : 'Cadastrar estabelecimento'}
        </DialogTitle>
        <DialogContent>
          {!isEditMode && (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Ao salvar, a conta do proprietário será criada automaticamente se ainda não existir,
              vinculada ao e-mail de contato informado.
            </Alert>
          )}

          <Box key={editEstId || 'new'}>
            <FormSection title="Identificação">
              <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={getPhotoUrl(fotoPerfil)}
                    alt={nome ? `Foto de ${nome}` : 'Prévia da foto do estabelecimento'}
                    variant="rounded"
                    sx={{ width: 96, height: 96, fontSize: '2rem' }}
                  >
                    <Business sx={{ fontSize: 44 }} />
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
                      aria-label="Selecionar foto do estabelecimento"
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

              <FormGrid columns={2}>
                <TextField
                  label="Nome do estabelecimento"
                  fullWidth
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <TextField
                  label="E-mail de contato (login do proprietário)"
                  type="email"
                  fullWidth
                  required
                  value={emailContato}
                  onChange={(e) => setEmailContato(e.target.value)}
                />
                <TextField
                  label="Telefone / contato"
                  fullWidth
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Ex: 84999999999"
                />
                <TextField
                  label="Website (opcional)"
                  fullWidth
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <FormSpan span={2}>
                  <TextField
                    label="Descrição"
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
              title="Endereço e localização"
              description="A cidade define em quais buscas o estabelecimento aparece."
            >
              <FormGrid columns={2}>
                <FormSpan span={2}>
                  <TextField
                    label="Endereço completo"
                    fullWidth
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </FormSpan>
                <TextField
                  label="CEP"
                  fullWidth
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                />
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
                <TextField
                  label="Latitude (opcional)"
                  type="number"
                  fullWidth
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
                <TextField
                  label="Longitude (opcional)"
                  type="number"
                  fullWidth
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </FormGrid>
            </FormSection>

            <Divider sx={{ my: 2.5 }} />

            <FormSection
              title="Pagamento e comodidades"
              description="O modo de pagamento vale para novas reservas; reservas existentes mantêm o modo da criação."
            >
              <FormGrid columns={1}>
                <FormControl fullWidth>
                  <InputLabel>Modo de pagamento</InputLabel>
                  <Select
                    value={modoPagamento}
                    onChange={(e) => setModoPagamento(e.target.value as 'PADRAO' | 'MERCADO_PAGO')}
                    label="Modo de pagamento"
                  >
                    <MenuItem value="PADRAO">Padrão (comprovante manual)</MenuItem>
                    <MenuItem value="MERCADO_PAGO">
                      Mercado Pago (reconhecimento automático)
                    </MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="textSecondary">
                  Em &quot;Mercado Pago&quot; o hóspede paga via PIX, boleto ou cartão e a reserva é
                  finalizada automaticamente após a aprovação.
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Comodidades e vantagens globais</InputLabel>
                  <Select
                    multiple
                    value={selectedAmenityIds}
                    onChange={(e) => setSelectedAmenityIds(e.target.value as string[])}
                    input={<OutlinedInput label="Comodidades e vantagens globais" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const amenity = amenities.find((a) => a.id === value);
                          return (
                            <Chip key={value} label={amenity?.nome || value} size="small" />
                          );
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
              </FormGrid>
            </FormSection>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenAddDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmit} loading={saving}>
            {isEditMode ? 'Salvar alterações' : 'Cadastrar estabelecimento'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de detalhes */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Detalhes do estabelecimento</DialogTitle>
        <DialogContent>
          {selectedEst && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar
                  src={getPhotoUrl(selectedEst.fotoPerfil)}
                  alt={`Foto de ${selectedEst.nome}`}
                  variant="rounded"
                  sx={{ width: 64, height: 64, fontSize: '1.5rem' }}
                >
                  <Business sx={{ fontSize: 28 }} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
                    {selectedEst.nome}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                    <StatusChip status={selectedEst.ativo ? 'ATIVO' : 'INATIVO'} />
                    <ModoPagamentoChip modo={selectedEst.modoPagamento || 'PADRAO'} />
                  </Stack>
                </Box>
              </Stack>

              {selectedEst.descricao && (
                <Typography variant="body2" color="textSecondary">
                  {selectedEst.descricao}
                </Typography>
              )}

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Contato e acesso
              </Typography>
              <InfoGrid columns={2}>
                <InfoItem
                  label="E-mail comercial"
                  value={selectedEst.emailContato || 'Não informado'}
                />
                <InfoItem label="Telefone" value={selectedEst.contato || 'Não informado'} />
                <InfoItem label="Website" value={selectedEst.website || 'Não informado'} />
                <InfoItem
                  label="Proprietário"
                  value={
                    selectedEst.proprietario ? (
                      <>
                        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                          {selectedEst.proprietario.nome}
                        </Typography>
                        <Typography component="span" variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                          {selectedEst.proprietario.email}
                        </Typography>
                      </>
                    ) : (
                      'Sem proprietário'
                    )
                  }
                />
              </InfoGrid>

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Endereço e localização
              </Typography>
              <InfoGrid columns={2}>
                <InfoItem label="Cidade" value={selectedEst.cidade?.nome || '—'} />
                <InfoItem label="CEP" value={selectedEst.cep || 'Não informado'} />
                <InfoItem label="Endereço" value={selectedEst.endereco || 'Não informado'} />
                <InfoItem label="Coordenadas" value={coordinates(selectedEst)} />
              </InfoGrid>

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Comodidades vinculadas
              </Typography>
              {selectedEst.comodidades.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Nenhuma comodidade global cadastrada.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {selectedEst.comodidades.map((item) => (
                    <Chip key={item.comodidade.id} label={item.comodidade.nome} size="small" />
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpenDetailDialog(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir estabelecimento"
        description={
          <>
            Deseja excluir o estabelecimento <strong>{estToDelete?.nome}</strong>? Esta ação não
            pode ser desfeita.
          </>
        }
        confirmLabel="Excluir estabelecimento"
        loading={deleting}
        tone="error"
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
      />
    </PageContainer>
  );
}
