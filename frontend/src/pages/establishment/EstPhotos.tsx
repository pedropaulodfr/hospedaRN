import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Chip,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import {
  Add,
  Delete,
  Star,
  StarBorder,
  Image,
  CloudUpload,
  Close,
} from '@mui/icons-material';
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

export default function EstPhotos() {
  const { user } = useAuthStore();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotosLoading, setFotosLoading] = useState(false);
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
      const res = await fotosApi.findByEstablishment(establishmentId);
      setFotos(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
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
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const coverFoto = fotos.find((f) => f.isCapa);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Gerenciar Fotos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie as fotos do estabelecimento, defina a foto de capa e organize a galeria.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {establishments.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="est-select-label">Estabelecimento</InputLabel>
              <Select
                labelId="est-select-label"
                value={selectedEstablishment?.id || ''}
                label="Estabelecimento"
                onChange={(e) => handleEstablishmentChange(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                {establishments.map((est) => (
                  <MenuItem key={est.id} value={est.id}>{est.nome}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenUpload}
            disabled={!selectedEstablishment}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
              boxShadow: '0 4px 14px 0 rgba(0, 151, 167, 0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #00838F, #00ACC1)' },
            }}
          >
            Adicionar Foto
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      {selectedEstablishment && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper sx={{
              p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider',
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <Box sx={{ p: 1.5, bgcolor: 'rgba(0, 151, 167, 0.08)', borderRadius: '12px', color: '#0097A7' }}>
                <Image />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Total de Fotos</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{fotos.length}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper sx={{
              p: 2.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider',
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <Box sx={{ p: 1.5, bgcolor: 'rgba(255, 193, 7, 0.08)', borderRadius: '12px', color: '#FFC107' }}>
                <Star />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Foto de Capa</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {coverFoto ? 'Definida' : 'Nenhuma'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Content */}
      {fotosLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !selectedEstablishment ? (
        <Paper sx={{ p: 6, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Typography color="text.secondary">Nenhum estabelecimento cadastrado ou selecionado.</Typography>
        </Paper>
      ) : fotos.length === 0 ? (
        <Paper sx={{ p: 8, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Image sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Nenhuma foto cadastrada
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Adicione fotos do seu estabelecimento para exibir na página de busca.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenUpload}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            Adicionar Primeira Foto
          </Button>
        </Paper>
      ) : (
        <ImageList variant="masonry" cols={3} gap={16}>
          {fotos.map((foto) => (
            <ImageListItem key={foto.id}>
              <Card
                sx={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 4px 20px 0 rgba(0,0,0,0.015)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 30px 0 rgba(0,0,0,0.04)',
                  },
                }}
              >
                <CardMedia
                  component="img"
                  image={foto.url}
                  alt={`Foto ${foto.ordem + 1}`}
                  sx={{
                    height: 240,
                    objectFit: 'cover',
                  }}
                />
                <ImageListItemBar
                  sx={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 70%, transparent 100%)',
                  }}
                  title={
                    foto.isCapa ? (
                      <Chip
                        icon={<Star sx={{ fontSize: '14px !important' }} />}
                        label="Capa"
                        size="small"
                        sx={{
                          bgcolor: '#FFC107',
                          color: '#000',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          borderRadius: '6px',
                        }}
                      />
                    ) : undefined
                  }
                  position="top"
                />
                <CardActions sx={{ justifyContent: 'space-between', px: 1.5, py: 1 }}>
                  <Box>
                    {!foto.isCapa && (
                      <Tooltip title="Definir como capa">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleSetCover(foto)}
                          disabled={saving}
                        >
                          <StarBorder fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Tooltip title="Remover foto">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleOpenDelete(foto)}
                      disabled={saving}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </ImageListItem>
          ))}
        </ImageList>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !saving && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Adicionar Foto
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
          />

          {!previewUrl ? (
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: '12px',
                p: 6,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(0, 151, 167, 0.04)',
                },
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                Clique para selecionar uma imagem
              </Typography>
              <Typography variant="body2" color="text.secondary">
                JPG, PNG ou WebP até 10MB
              </Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative' }}>
              <IconButton
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                size="small"
                disabled={saving}
              >
                <Close fontSize="small" />
              </IconButton>
              <Box
                component="img"
                src={previewUrl}
                alt="Preview"
                sx={{
                  width: '100%',
                  maxHeight: 400,
                  objectFit: 'contain',
                  borderRadius: '12px',
                  bgcolor: '#000',
                }}
              />
            </Box>
          )}

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
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setUploadDialogOpen(false)}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || saving}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Fazer Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !saving && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deseja realmente excluir esta foto? Esta ação é irreversível.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={saving}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {saving ? 'Excluindo...' : 'Sim, Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
