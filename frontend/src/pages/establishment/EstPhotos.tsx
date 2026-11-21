import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AddOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ImageOutlined,
  PhotoLibraryOutlined,
  StarBorderOutlined,
  StarOutlined,
} from '@mui/icons-material';
import {
  CardGridSkeleton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormActions,
  FormSection,
  InlineLoading,
  PageContainer,
  PageHeader,
  PageLoading,
  StatCard,
} from '../../components/common';
import { establishmentsApi, fotosApi, uploadsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

interface Foto {
  id: string;
  url: string;
  s3Key: string;
  entidade: string;
  entidadeId: string;
  ordem: number;
  isCapa: boolean;
  criadoEm: string;
}

interface Establishment {
  id: string;
  nome: string;
  proprietarioId: string;
}

function formatarTamanho(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function EstPhotos() {
  const { user } = useAuthStore();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotosLoading, setFotosLoading] = useState(false);
  const [fotosError, setFotosError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [defineAsCover, setDefineAsCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fotoToDelete, setFotoToDelete] = useState<Foto | null>(null);

  // Load establishments
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        let userEsts: Establishment[] = [];
        try {
          const estsRes = await establishmentsApi.getMy();
          userEsts = estsRes.data.data || estsRes.data || [];
        } catch (err) {
          console.error('Erro ao carregar estabelecimentos proprietário.', err);
        }

        const linkedEstId = (user as any)?.estabelecimentoVinculadoId;
        if (userEsts.length === 0 && linkedEstId) {
          try {
            const singleEstRes = await establishmentsApi.getOne(linkedEstId);
            const singleEst = singleEstRes.data.data || singleEstRes.data;
            if (singleEst) userEsts = [singleEst];
          } catch (err) {
            console.error('Erro ao carregar estabelecimento vinculado do sub-usuario.', err);
          }
        }

        setEstablishments(userEsts);
        if (userEsts.length > 0) {
          setSelectedEstablishment(userEsts[0]);
        }
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar dados iniciais');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Fetch fotos
  const fetchFotos = async (establishmentId: string) => {
    try {
      setFotosLoading(true);
      setFotosError(false);
      const res = await fotosApi.findByEstablishment(establishmentId);
      setFotos(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
      setFotosError(true);
      toast.error('Erro ao carregar fotos');
    } finally {
      setFotosLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEstablishment) {
      fetchFotos(selectedEstablishment.id);
    } else {
      setFotos([]);
    }
  }, [selectedEstablishment]);

  const handleEstablishmentChange = (estId: string) => {
    const est = establishments.find((e) => e.id === estId) || null;
    setSelectedEstablishment(est);
  };

  // Open upload dialog
  const handleOpenUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setDefineAsCover(false);
    setUploadDialogOpen(true);
  };

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Upload image -> create foto record
  const handleUpload = async () => {
    if (!selectedFile || !selectedEstablishment) return;

    try {
      setSaving(true);

      const uploadRes = await uploadsApi.uploadImage('estabelecimentos', selectedFile);
      const uploaded = uploadRes.data.data || uploadRes.data;

      await fotosApi.create({
        url: uploaded.url,
        s3Key: uploaded.s3Key || uploaded.key,
        estabelecimentoId: selectedEstablishment.id,
        isCapa: defineAsCover || fotos.length === 0,
      });

      toast.success('Foto adicionada com sucesso');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchFotos(selectedEstablishment.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao fazer upload da foto');
    } finally {
      setSaving(false);
    }
  };

  // Set as cover
  const handleSetCover = async (foto: Foto) => {
    try {
      setSaving(true);
      await fotosApi.update(foto.id, { isCapa: true });
      toast.success('Foto definida como capa');
      fetchFotos(selectedEstablishment!.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao definir foto como capa');
    } finally {
      setSaving(false);
    }
  };

  // Open delete dialog
  const handleOpenDelete = (foto: Foto) => {
    setFotoToDelete(foto);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!fotoToDelete || !selectedEstablishment) return;
    try {
      setSaving(true);
      await fotosApi.delete(fotoToDelete.id);
      toast.success('Foto removida com sucesso');
      setDeleteDialogOpen(false);
      setFotoToDelete(null);
      fetchFotos(selectedEstablishment.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao remover foto');
    } finally {
      setSaving(false);
    }
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (loading) {
    return <PageLoading label="Carregando fotos…" />;
  }

  const coverFoto = fotos.find((f) => f.isCapa);
  const nomeEstabelecimento = selectedEstablishment?.nome ?? 'estabelecimento';

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Estabelecimento"
        title="Galeria de fotos"
        subtitle="As fotos são a primeira impressão do anúncio. Mantenha uma capa forte e uma galeria organizada com os ambientes reais."
        icon={<PhotoLibraryOutlined />}
        actions={
          <>
            {establishments.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="est-select-label">Estabelecimento</InputLabel>
                <Select
                  labelId="est-select-label"
                  value={selectedEstablishment?.id || ''}
                  label="Estabelecimento"
                  onChange={(e) => handleEstablishmentChange(e.target.value)}
                >
                  {establishments.map((est) => (
                    <MenuItem key={est.id} value={est.id}>{est.nome}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={handleOpenUpload}
              disabled={!selectedEstablishment}
            >
              Adicionar foto
            </Button>
          </>
        }
      />

      {/* Indicadores */}
      {selectedEstablishment && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
            mb: { xs: 3, md: 4 },
            maxWidth: 760,
          }}
        >
          <StatCard
            label="Total de fotos"
            value={fotos.length}
            icon={<ImageOutlined />}
            tone="primary"
            hint={fotos.length === 0 ? 'Adicione a primeira foto' : 'Na galeria do estabelecimento'}
          />
          <StatCard
            label="Foto de capa"
            value={coverFoto ? 'Definida' : 'Nenhuma'}
            icon={<StarOutlined />}
            tone={coverFoto ? 'success' : 'neutral'}
            hint={coverFoto ? 'Exibida nos resultados de busca' : 'Defina uma capa para destacar o anúncio'}
          />
        </Box>
      )}

      {/* Conteúdo */}
      {fotosLoading ? (
        <CardGridSkeleton count={6} height={240} />
      ) : !selectedEstablishment ? (
        <Card>
          <EmptyState
            title="Nenhum estabelecimento selecionado"
            description="Não encontramos um estabelecimento vinculado à sua conta. Se você é sub-usuário, confirme o vínculo com o proprietário."
            icon={<PhotoLibraryOutlined />}
          />
        </Card>
      ) : fotosError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar as fotos"
            description="Ocorreu uma falha ao buscar a galeria. Tente novamente em instantes."
            onRetry={() => fetchFotos(selectedEstablishment.id)}
          />
        </Card>
      ) : fotos.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma foto cadastrada"
            description="Adicione fotos dos quartos, áreas comuns e fachada. A primeira imagem será usada como capa."
            icon={<ImageOutlined />}
            action={
              <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenUpload}>
                Adicionar primeira foto
              </Button>
            }
          />
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: { xs: 2, md: 3 },
          }}
        >
          {fotos.map((foto, index) => (
            <Card key={foto.id} sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ position: 'relative', bgcolor: 'action.hover' }}>
                <Box
                  component="img"
                  src={foto.url}
                  alt={`Foto ${index + 1} de ${fotos.length} do estabelecimento ${nomeEstabelecimento}${foto.isCapa ? ' — foto de capa' : ''}`}
                  loading="lazy"
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: 220,
                    objectFit: 'cover',
                  }}
                />
                {foto.isCapa && (
                  <Chip
                    icon={<StarOutlined />}
                    label="Foto de capa"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      bgcolor: 'background.paper',
                      color: 'primary.main',
                      border: '1px solid',
                      borderColor: 'divider',
                      '& .MuiChip-icon': { color: 'primary.main', ml: 1, mr: -0.25 },
                    }}
                  />
                )}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  {`Foto ${index + 1} de ${fotos.length}`}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  {!foto.isCapa && (
                    <Tooltip title="Definir como foto de capa">
                      <span>
                        <IconButton
                          size="small"
                          color="warning"
                          aria-label={`Definir foto ${index + 1} como capa`}
                          onClick={() => handleSetCover(foto)}
                          disabled={saving}
                        >
                          <StarBorderOutlined fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip title="Remover foto">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remover foto ${index + 1}`}
                        onClick={() => handleOpenDelete(foto)}
                        disabled={saving}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !saving && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="h2">Adicionar foto</DialogTitle>
        <DialogContent>
          <FormSection description="Envie uma imagem de boa qualidade do ambiente. A primeira foto enviada vira capa automaticamente.">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileSelect}
            />

            {!previewUrl ? (
              <ButtonBase
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  p: { xs: 4, sm: 6 },
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  textAlign: 'center',
                  transition: 'border-color 120ms, background-color 120ms',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <CloudUploadOutlined sx={{ fontSize: 44, color: 'text.secondary' }} />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Clique para selecionar uma imagem
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  JPG, PNG ou WebP até 10 MB
                </Typography>
              </ButtonBase>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  aria-label="Remover imagem selecionada"
                  size="small"
                  disabled={saving}
                  sx={(theme) => ({
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: alpha(theme.palette.common.black, 0.55),
                    color: theme.palette.common.white,
                    '&:hover': { bgcolor: alpha(theme.palette.common.black, 0.75) },
                  })}
                >
                  <CloseOutlined fontSize="small" />
                </IconButton>
                <Box
                  component="img"
                  src={previewUrl}
                  alt="Pré-visualização da foto selecionada"
                  sx={{
                    width: '100%',
                    maxHeight: 380,
                    objectFit: 'contain',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                />
                {selectedFile && (
                  <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 1 }}>
                    {`${selectedFile.name} · ${formatarTamanho(selectedFile.size)}`}
                  </Typography>
                )}
              </Box>
            )}

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={defineAsCover}
                    onChange={(e) => setDefineAsCover(e.target.checked)}
                    disabled={saving}
                  />
                }
                label="Definir como foto de capa"
              />
              <Typography variant="caption" color="textSecondary" component="p" sx={{ pl: 4 }}>
                A capa aparece nos cards de busca e no topo da página do estabelecimento.
              </Typography>
            </Box>

            {saving && <InlineLoading label="Enviando foto…" />}
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button color="inherit" onClick={() => setUploadDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleUpload} disabled={!selectedFile || saving}>
            {saving ? 'Enviando…' : 'Fazer upload'}
          </Button>
        </FormActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Remover foto"
        description="Remover esta foto da galeria? Esta ação é irreversível."
        confirmLabel="Remover foto"
        tone="error"
        loading={saving}
        onConfirm={handleConfirmDelete}
        onClose={() => { if (!saving) setDeleteDialogOpen(false); }}
      >
        {fotoToDelete && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box
              component="img"
              src={fotoToDelete.url}
              alt={`Foto ${fotoToDelete.ordem + 1} que será removida`}
              sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 2 }}
            />
          </>
        )}
      </ConfirmDialog>
    </PageContainer>
  );
}
