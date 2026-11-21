import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  InputAdornment,
  Divider,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AddOutlined,
  AttachMoneyOutlined,
  CalendarMonthOutlined,
  ClassOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  GridOnOutlined,
  HotelOutlined,
  ImageOutlined,
  InfoOutlined,
  LockOpenOutlined,
  LockOutlined,
  PeopleOutlined,
  PhotoLibraryOutlined,
  SettingsOutlined,
  TuneOutlined,
} from '@mui/icons-material';
import {
  CardGridSkeleton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormActions,
  FormGrid,
  FormSection,
  FormSpan,
  InlineLoading,
  PageContainer,
  PageHeader,
  PageLoading,
  SectionCard,
  StatCard,
  StatusChip,
} from '../../components/common';
import { formatCurrency } from '../../theme/tokens';
import { establishmentsApi, roomsApi, accommodationTypesApi, fotosApi, uploadsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

interface RoomType {
  id: string;
  nome: string;
  descricao?: string;
}

interface Season {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  percentualAjuste: string | number;
}

interface RoomPrice {
  quartoId: string;
  temporadaId: string;
  valor: number | string;
  temporada: Season;
}

interface DateBlock {
  id: string;
  quartoId: string;
  data: string;
  motivo?: string;
}

interface Room {
  id: string;
  estabelecimentoId: string;
  tipoAcomodacaoId?: string;
  nome: string;
  capacidade: number;
  quantidade: number;
  descricao?: string;
  precoBase: number | string;
  ativo: boolean;
  tipoAcomodacao?: RoomType;
  precos?: RoomPrice[];
  bloqueiosData?: DateBlock[];
}

interface RoomPhoto {
  id: string;
  url: string;
  s3Key: string;
  ordem: number;
  isCapa: boolean;
  criadoEm: string;
}

interface Establishment {
  id: string;
  nome: string;
  proprietarioId: string;
}

export default function EstRooms() {
  const { user } = useAuthStore();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState(false);
  const [saving, setSaving] = useState(false);

  // CRUD Room Dialog
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoBase, setPrecoBase] = useState<number | string>('');
  const [capacidade, setCapacidade] = useState<number | string>(2);
  const [quantidade, setQuantidade] = useState<number | string>(1);
  const [tipoAcomodacaoId, setTipoAcomodacaoId] = useState('');
  const [ativo, setAtivo] = useState(true);

  // Delete Room Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Prices & Blocks Dialog
  const [pricesDialogOpen, setPricesDialogOpen] = useState(false);
  const [detailedRoom, setDetailedRoom] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Seasonal Price Form
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [seasonPriceValue, setSeasonPriceValue] = useState<number | string>('');

  // Block Date Form
  const [blockDateValue, setBlockDateValue] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Room Photos Dialog
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [photosRoom, setPhotosRoom] = useState<Room | null>(null);
  const [roomPhotos, setRoomPhotos] = useState<RoomPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Accommodation Type Dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);

  // Delete Accommodation Type
  const [typeToDelete, setTypeToDelete] = useState<RoomType | null>(null);
  const [deleteTypeDialogOpen, setDeleteTypeDialogOpen] = useState(false);
  const [deletingType, setDeletingType] = useState(false);

  // Load Initial Data: User's establishments and room types
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Seasons
        try {
          const seasonsRes = await roomsApi.getSeasons();
          setSeasons(seasonsRes.data.data || seasonsRes.data || []);
        } catch (err) {
          console.error('Erro ao carregar temporadas, usando lista vazia.', err);
        }

        // 3. Fetch Establishments
        let userEsts: Establishment[] = [];
        try {
          const estsRes = await establishmentsApi.getMy();
          userEsts = estsRes.data.data || estsRes.data || [];
        } catch (err) {
          console.error('Erro ao carregar estabelecimentos proprietário.', err);
        }

        // If sub-user has a linked establishment, fetch it
        const linkedEstId = (user as any)?.estabelecimentoVinculadoId;
        if (userEsts.length === 0 && linkedEstId) {
          try {
            const singleEstRes = await establishmentsApi.getOne(linkedEstId);
            const singleEst = singleEstRes.data.data || singleEstRes.data;
            if (singleEst) {
              userEsts = [singleEst];
            }
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

  // Fetch Rooms when selected establishment changes
  const fetchRooms = async (establishmentId: string) => {
    try {
      setRoomsLoading(true);
      setRoomsError(false);
      const res = await roomsApi.getByEstablishment(establishmentId);
      setRooms(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
      setRoomsError(true);
      toast.error('Erro ao carregar quartos do estabelecimento');
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchRoomTypes = async (establishmentId: string) => {
    try {
      const res = await accommodationTypesApi.getByEstablishment(establishmentId);
      setRoomTypes(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (selectedEstablishment) {
      fetchRooms(selectedEstablishment.id);
      fetchRoomTypes(selectedEstablishment.id);
    } else {
      setRooms([]);
      setRoomTypes([]);
    }
  }, [selectedEstablishment]);

  const handleEstablishmentChange = (estId: string) => {
    const est = establishments.find((e) => e.id === estId) || null;
    setSelectedEstablishment(est);
  };

  // Open Dialog to Add Room
  const handleOpenAdd = () => {
    setSelectedRoom(null);
    setNome('');
    setDescricao('');
    setPrecoBase('');
    setCapacidade(2);
    setQuantidade(1);
    setTipoAcomodacaoId(roomTypes[0]?.id || '');
    setAtivo(true);
    setRoomDialogOpen(true);
  };

  // Open Dialog to Edit Room
  const handleOpenEdit = (room: Room) => {
    setSelectedRoom(room);
    setNome(room.nome);
    setDescricao(room.descricao || '');
    setPrecoBase(Number(room.precoBase));
    setCapacidade(room.capacidade);
    setQuantidade(room.quantidade);
    setTipoAcomodacaoId(room.tipoAcomodacaoId || '');
    setAtivo(room.ativo);
    setRoomDialogOpen(true);
  };

  // Save Room (Create/Update)
  const handleSaveRoom = async () => {
    if (!nome || !precoBase || !capacidade || !quantidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!selectedEstablishment) {
      toast.error('Selecione um estabelecimento');
      return;
    }

    const payload = {
      nome,
      descricao,
      precoBase: Number(precoBase),
      capacidade: Number(capacidade),
      quantidade: Number(quantidade),
      tipoAcomodacaoId: tipoAcomodacaoId || undefined,
      estabelecimentoId: selectedEstablishment.id,
      ativo,
    };

    try {
      setSaving(true);
      if (selectedRoom) {
        // Update room
        await roomsApi.update(selectedRoom.id, {
          nome,
          descricao,
          precoBase: Number(precoBase),
          capacidade: Number(capacidade),
          quantidade: Number(quantidade),
          tipoAcomodacaoId: tipoAcomodacaoId || undefined,
        });
        toast.success('Quarto atualizado com sucesso');
      } else {
        // Create room
        await roomsApi.create(payload);
        toast.success('Quarto adicionado com sucesso');
      }
      setRoomDialogOpen(false);
      fetchRooms(selectedEstablishment.id);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao salvar quarto';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Create New Accommodation Type
  const handleCreateType = async () => {
    if (!newTypeName.trim()) {
      toast.error('Informe o nome do tipo de acomodação');
      return;
    }
    try {
      setSavingType(true);
      await accommodationTypesApi.create({ nome: newTypeName.trim() });
      toast.success('Tipo de acomodação cadastrado com sucesso');
      setTypeDialogOpen(false);
      setNewTypeName('');
      if (selectedEstablishment) {
        fetchRoomTypes(selectedEstablishment.id);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao cadastrar tipo';
      toast.error(msg);
    } finally {
      setSavingType(false);
    }
  };

  // Delete Accommodation Type
  const handleDeleteTypeConfirm = async () => {
    if (!typeToDelete) return;
    try {
      setDeletingType(true);
      const res = await accommodationTypesApi.delete(typeToDelete.id);
      const data = res.data?.data || res.data;
      const desvinculados = data?.quartosDesvinculados ?? 0;
      if (desvinculados > 0) {
        toast.success(`"${typeToDelete.nome}" excluído. ${desvinculados} quarto(s) desvinculado(s).`);
      } else {
        toast.success(`"${typeToDelete.nome}" excluído com sucesso`);
      }
      setDeleteTypeDialogOpen(false);
      setTypeToDelete(null);
      if (selectedEstablishment) {
        fetchRoomTypes(selectedEstablishment.id);
        fetchRooms(selectedEstablishment.id);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao excluir tipo';
      toast.error(msg);
    } finally {
      setDeletingType(false);
    }
  };

  // Toggle Room Active Status
  const handleToggleActive = async (room: Room) => {
    try {
      await roomsApi.update(room.id, { ativo: !room.ativo });
      toast.success(`Quarto ${!room.ativo ? 'ativado' : 'desativado'} com sucesso`);
      if (selectedEstablishment) {
        fetchRooms(selectedEstablishment.id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status do quarto');
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (room: Room) => {
    setRoomToDelete(room);
    setDeleteDialogOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!roomToDelete || !selectedEstablishment) return;
    try {
      setSaving(true);
      await roomsApi.delete(roomToDelete.id);
      toast.success('Quarto removido com sucesso');
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      fetchRooms(selectedEstablishment.id);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover quarto');
    } finally {
      setSaving(false);
    }
  };

  // Fetch Room Details for Pricing and Blocks
  const fetchRoomDetails = async (roomId: string) => {
    try {
      const res = await roomsApi.getOne(roomId);
      setDetailedRoom(res.data.data || res.data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar detalhes do quarto');
    }
  };

  // Open Prices & Calendar Dialog
  const handleOpenPrices = async (room: Room) => {
    setSelectedRoom(room);
    setDetailedRoom(room); // temporary fallback
    setPricesDialogOpen(true);
    setActiveTab(0);
    setSelectedSeasonId('');
    setSeasonPriceValue('');
    setBlockDateValue('');
    setBlockReason('');
    await fetchRoomDetails(room.id);
  };

  // Save Seasonal Price
  const handleSaveSeasonalPrice = async () => {
    if (!selectedRoom || !selectedSeasonId || !seasonPriceValue) {
      toast.error('Selecione a temporada e informe o valor');
      return;
    }

    try {
      setSaving(true);
      await roomsApi.setPrice(selectedRoom.id, {
        temporadaId: selectedSeasonId,
        valor: Number(seasonPriceValue),
      });
      toast.success('Preço por temporada definido com sucesso');
      setSelectedSeasonId('');
      setSeasonPriceValue('');
      await fetchRoomDetails(selectedRoom.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao definir preço');
    } finally {
      setSaving(false);
    }
  };

  // Block Date
  const handleBlockDate = async () => {
    if (!selectedRoom || !blockDateValue) {
      toast.error('Selecione uma data para bloquear');
      return;
    }

    try {
      setSaving(true);
      await roomsApi.blockDate(selectedRoom.id, {
        data: new Date(blockDateValue),
        motivo: blockReason || undefined,
      });
      toast.success('Data bloqueada com sucesso');
      setBlockDateValue('');
      setBlockReason('');
      await fetchRoomDetails(selectedRoom.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao bloquear data');
    } finally {
      setSaving(false);
    }
  };

  // Fetch Room Photos
  const fetchRoomPhotos = async (roomId: string) => {
    try {
      setPhotosLoading(true);
      const res = await fotosApi.findByRoom(roomId);
      setRoomPhotos(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar fotos do quarto');
    } finally {
      setPhotosLoading(false);
    }
  };

  // Open Photos Dialog
  const handleOpenPhotos = async (room: Room) => {
    setPhotosRoom(room);
    setUploadFile(null);
    setUploadPreview(null);
    setPhotosDialogOpen(true);
    await fetchRoomPhotos(room.id);
  };

  // Upload Room Photo
  const handleUploadRoomPhoto = async () => {
    if (!uploadFile || !photosRoom) return;
    try {
      setSaving(true);
      const uploadRes = await uploadsApi.uploadImage('quartos', uploadFile);
      const uploaded = uploadRes.data.data || uploadRes.data;
      await fotosApi.create({
        url: uploaded.url,
        s3Key: uploaded.s3Key || uploaded.key,
        quartoId: photosRoom.id,
      });
      toast.success('Foto adicionada com sucesso');
      setUploadFile(null);
      setUploadPreview(null);
      await fetchRoomPhotos(photosRoom.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao fazer upload da foto');
    } finally {
      setSaving(false);
    }
  };

  // Delete Room Photo
  const handleDeleteRoomPhoto = async (fotoId: string) => {
    if (!photosRoom) return;
    try {
      setSaving(true);
      await fotosApi.delete(fotoId);
      toast.success('Foto removida com sucesso');
      await fetchRoomPhotos(photosRoom.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao remover foto');
    } finally {
      setSaving(false);
    }
  };

  // Unblock Date
  const handleUnblockDate = async (dateStr: string) => {
    if (!selectedRoom) return;
    try {
      // Unblock date expects date in YYYY-MM-DD
      const formattedDate = dayjs(dateStr).format('YYYY-MM-DD');
      await roomsApi.unblockDate(selectedRoom.id, formattedDate);
      toast.success('Data desbloqueada com sucesso');
      await fetchRoomDetails(selectedRoom.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao desbloquear data');
    }
  };

  if (loading) {
    return <PageLoading label="Carregando quartos e acomodações…" />;
  }

  // Statistics calculations
  const totalRoomsCount = rooms.reduce((sum, r) => sum + r.quantidade, 0);
  const activeRoomsCount = rooms.filter((r) => r.ativo).length;
  const avgPrice = rooms.length > 0
    ? (rooms.reduce((sum, r) => sum + Number(r.precoBase), 0) / rooms.length).toFixed(2)
    : '0,00';
  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacidade * r.quantidade), 0);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Estabelecimento"
        title="Quartos e acomodações"
        subtitle="Cadastre quartos, defina a diária base, ajuste preços por temporada e bloqueie datas da agenda."
        icon={<HotelOutlined />}
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
                    <MenuItem key={est.id} value={est.id}>
                      {est.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={handleOpenAdd}
              disabled={!selectedEstablishment}
            >
              Novo quarto
            </Button>
          </>
        }
      />

      {/* Stats Summary Panel */}
      {selectedEstablishment && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 2.5,
            mb: { xs: 3, md: 4 },
          }}
        >
          <StatCard
            label="Quartos"
            value={totalRoomsCount}
            icon={<HotelOutlined />}
            tone="primary"
            hint={totalRoomsCount === 1 ? '1 unidade no inventário' : `${totalRoomsCount} unidades no inventário`}
          />
          <StatCard
            label="Categorias ativas"
            value={activeRoomsCount}
            icon={<GridOnOutlined />}
            tone="success"
            hint={rooms.length === 0 ? 'Nenhuma categoria cadastrada' : `de ${rooms.length} cadastradas`}
          />
          <StatCard
            label="Preço médio base"
            value={formatCurrency(Number(avgPrice))}
            icon={<AttachMoneyOutlined />}
            tone="secondary"
            hint="Diária média das categorias"
          />
          <StatCard
            label="Capacidade total"
            value={totalCapacity}
            icon={<PeopleOutlined />}
            tone="info"
            hint={totalCapacity === 1 ? '1 hóspede' : `${totalCapacity} hóspedes`}
          />
        </Box>
      )}

      {/* Main Content Area */}
      {roomsLoading ? (
        <CardGridSkeleton count={4} height={260} />
      ) : roomsError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar os quartos"
            description="Ocorreu uma falha ao buscar as acomodações do estabelecimento. Tente novamente em instantes."
            onRetry={() => selectedEstablishment && fetchRooms(selectedEstablishment.id)}
          />
        </Card>
      ) : !selectedEstablishment ? (
        <Card>
          <EmptyState
            title="Nenhum estabelecimento selecionado"
            description="Não encontramos um estabelecimento vinculado à sua conta. Se você é sub-usuário, confirme o vínculo com o proprietário."
            icon={<HotelOutlined />}
          />
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum quarto cadastrado"
            description="Cadastre a primeira acomodação para começar a receber reservas e definir preços por temporada."
            icon={<HotelOutlined />}
            action={
              <Button variant="contained" startIcon={<AddOutlined />} onClick={handleOpenAdd}>
                Cadastrar primeiro quarto
              </Button>
            }
          />
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: { xs: 2, md: 3 },
          }}
        >
          {rooms.map((room) => (
            <Card
              key={room.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                borderColor: room.ativo ? 'divider' : 'warning.main',
                opacity: room.ativo ? 1 : 0.8,
                transition: 'border-color 180ms, box-shadow 180ms, transform 180ms',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) => `0 10px 30px ${alpha(theme.palette.text.primary, 0.08)}`,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, p: 3, pb: '0 !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  {/* A listagem da API não traz fotos do quarto; o bloco é um marcador visual neutro. */}
                  <Box
                    aria-hidden
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'action.selected',
                      color: 'primary.main',
                    }}
                  >
                    <HotelOutlined />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" component="p" sx={{ fontWeight: 600 }} noWrap>
                      {room.nome}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      {room.tipoAcomodacao && (
                        <Chip
                          icon={<ClassOutlined sx={{ fontSize: 14 }} />}
                          label={room.tipoAcomodacao.nome}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      <StatusChip status={room.ativo ? 'ATIVO' : 'INATIVO'} />
                    </Box>
                  </Box>
                  <Tooltip title={room.ativo ? 'Desativar quarto' : 'Ativar quarto'}>
                    <Switch
                      checked={room.ativo}
                      onChange={() => handleToggleActive(room)}
                      color="success"
                      size="small"
                      slotProps={{
                        input: {
                          'aria-label': `${room.ativo ? 'Desativar' : 'Ativar'} quarto ${room.nome}`,
                        },
                      }}
                    />
                  </Tooltip>
                </Box>

                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{
                    minHeight: 40,
                    mb: 2.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {room.descricao || 'Sem descrição cadastrada.'}
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 1.5,
                    pb: 2.5,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="textSecondary" component="p">
                      Capacidade
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PeopleOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
                      {room.capacidade} {room.capacidade === 1 ? 'pessoa' : 'pessoas'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary" component="p">
                      Quantidade
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <HotelOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
                      {room.quantidade} {room.quantidade === 1 ? 'quarto' : 'quartos'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary" component="p">
                      Diária base
                    </Typography>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                      {formatCurrency(room.precoBase)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>

              <CardActions
                sx={{
                  px: 3,
                  py: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoLibraryOutlined />}
                    onClick={() => handleOpenPhotos(room)}
                  >
                    Fotos
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CalendarMonthOutlined />}
                    onClick={() => handleOpenPrices(room)}
                  >
                    Preços e agenda
                  </Button>
                </Box>

                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Tooltip title="Editar quarto">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label={`Editar quarto ${room.nome}`}
                      onClick={() => handleOpenEdit(room)}
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remover quarto">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Remover quarto ${room.nome}`}
                      onClick={() => handleOpenDelete(room)}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* CRUD Room Dialog */}
      <Dialog
        open={roomDialogOpen}
        onClose={() => !saving && setRoomDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="h2">
          {selectedRoom ? 'Editar quarto' : 'Novo quarto'}
        </DialogTitle>
        <DialogContent>
          <FormSection
            title="Identificação"
            description="Como a acomodação aparece para o hóspede na busca do estabelecimento."
          >
            <FormGrid columns={2}>
              <FormSpan span={2}>
                <TextField
                  label="Nome do quarto"
                  fullWidth
                  required
                  disabled={saving}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Quarto luxo casal"
                />
              </FormSpan>

              <FormSpan span={2}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'flex-start',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  }}
                >
                  <FormControl fullWidth required sx={{ flex: 1, minWidth: 200 }}>
                    <InputLabel id="room-type-label">Tipo de acomodação</InputLabel>
                    <Select
                      labelId="room-type-label"
                      value={tipoAcomodacaoId}
                      label="Tipo de acomodação"
                      disabled={saving}
                      onChange={(e) => setTipoAcomodacaoId(e.target.value)}
                    >
                      {roomTypes.map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.nome}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Tooltip title="Gerenciar tipos de acomodação">
                    <Button
                      variant="outlined"
                      startIcon={<TuneOutlined />}
                      onClick={() => setTypeDialogOpen(true)}
                      disabled={saving}
                      sx={{ minHeight: 56, flexShrink: 0 }}
                    >
                      Gerenciar
                    </Button>
                  </Tooltip>
                </Box>
              </FormSpan>

              <FormSpan span={2}>
                <TextField
                  label="Descrição detalhada"
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={saving}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva as comodidades do quarto: ar-condicionado, frigobar, TV, varanda…"
                  helperText="Aparece no card e na página de detalhes da acomodação."
                />
              </FormSpan>
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 3 }} />

          <FormSection
            title="Capacidade e diária"
            description="Valores de referência usados no cálculo de disponibilidade e preço."
          >
            <FormGrid columns={2}>
              <TextField
                label="Preço base (diária)"
                fullWidth
                required
                type="number"
                disabled={saving}
                value={precoBase}
                onChange={(e) => setPrecoBase(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  },
                }}
                helperText="Diária padrão fora das temporadas."
              />
              <TextField
                label="Capacidade de hóspedes"
                fullWidth
                required
                type="number"
                disabled={saving}
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                helperText="Número máximo de pessoas por quarto."
              />
              <FormSpan span={2}>
                <TextField
                  label="Quantidade de quartos"
                  fullWidth
                  required
                  type="number"
                  disabled={saving}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  helperText="Número total de quartos desta categoria no inventário."
                />
              </FormSpan>
            </FormGrid>
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button color="inherit" onClick={() => setRoomDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveRoom} disabled={saving}>
            {saving ? 'Salvando…' : selectedRoom ? 'Salvar alterações' : 'Cadastrar quarto'}
          </Button>
        </FormActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Remover quarto"
        description={
          <>
            Remover a acomodação <strong>{roomToDelete?.nome}</strong>? Esta ação é irreversível e removerá todos os preços e bloqueios vinculados.
          </>
        }
        confirmLabel="Remover quarto"
        tone="error"
        loading={saving}
        onConfirm={handleConfirmDelete}
        onClose={() => { if (!saving) setDeleteDialogOpen(false); }}
      />

      {/* Room Photos Dialog */}
      <Dialog
        open={photosDialogOpen}
        onClose={() => { setPhotosDialogOpen(false); setUploadPreview(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="h2">
          {photosRoom ? `Fotos do quarto: ${photosRoom.nome}` : 'Fotos do quarto'}
        </DialogTitle>
        <DialogContent>
          {photosLoading ? (
            <Box sx={{ py: 2 }}>
              <InlineLoading label="Carregando fotos…" />
            </Box>
          ) : roomPhotos.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <ImageOutlined sx={{ fontSize: 40, color: 'text.secondary', mb: 0.5 }} aria-hidden />
              <Typography variant="body2" color="textSecondary">
                Nenhuma foto cadastrada para este quarto.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1.5,
              }}
            >
              {roomPhotos.map((foto) => (
                <Box
                  key={foto.id}
                  sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}
                >
                  <Box
                    component="img"
                    src={foto.url}
                    alt={`Foto ${foto.ordem + 1} do quarto ${photosRoom?.nome ?? ''}`}
                    loading="lazy"
                    sx={{ display: 'block', width: '100%', height: 140, objectFit: 'cover' }}
                  />
                  <Tooltip title="Remover foto">
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Remover foto ${foto.ordem + 1}`}
                        onClick={() => handleDeleteRoomPhoto(foto.id)}
                        disabled={saving}
                        sx={(theme) => ({
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          bgcolor: alpha(theme.palette.common.black, 0.55),
                          color: theme.palette.common.white,
                          '&:hover': { bgcolor: alpha(theme.palette.common.black, 0.75) },
                        })}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <FormSection title="Adicionar nova foto" description="JPG, PNG ou WebP até 10 MB.">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (!file.type.startsWith('image/')) { toast.error('Selecione apenas imagens'); return; }
                if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB'); return; }
                setUploadFile(file);
                setUploadPreview(URL.createObjectURL(file));
              }
            }} />
            {!uploadPreview ? (
              <ButtonBase
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  p: 3,
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  textAlign: 'center',
                  transition: 'border-color 120ms, background-color 120ms',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CloudUploadOutlined sx={{ fontSize: 36, color: 'text.secondary' }} />
                <Typography variant="body2" color="textSecondary">
                  Clique para selecionar uma imagem
                </Typography>
              </ButtonBase>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                  aria-label="Remover imagem selecionada"
                  disabled={saving}
                  sx={(theme) => ({
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    bgcolor: alpha(theme.palette.common.black, 0.55),
                    color: theme.palette.common.white,
                    '&:hover': { bgcolor: alpha(theme.palette.common.black, 0.75) },
                  })}
                  size="small"
                >
                  <CloseOutlined fontSize="small" />
                </IconButton>
                <Box
                  component="img"
                  src={uploadPreview}
                  alt="Pré-visualização da foto do quarto"
                  sx={{
                    width: '100%',
                    maxHeight: 240,
                    objectFit: 'contain',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                />
              </Box>
            )}
            <Button
              variant="contained"
              fullWidth
              disabled={!uploadFile || saving}
              onClick={handleUploadRoomPhoto}
              startIcon={<CloudUploadOutlined />}
            >
              {saving ? 'Enviando…' : 'Enviar foto'}
            </Button>
            {saving && <InlineLoading label="Enviando foto…" />}
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button onClick={() => { setPhotosDialogOpen(false); setUploadPreview(null); }} variant="contained">
            Fechar
          </Button>
        </FormActions>
      </Dialog>

      {/* Prices & Calendar Management Dialog */}
      <Dialog
        open={pricesDialogOpen}
        onClose={() => setPricesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="div">
          <Typography variant="h6" component="h2">
            {selectedRoom ? `Preços e agenda: ${selectedRoom.nome}` : 'Preços e agenda'}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            {`Diária base atual: ${formatCurrency(selectedRoom ? Number(selectedRoom.precoBase) : 0)}`}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab
              icon={<AttachMoneyOutlined />}
              label="Preços por temporada"
              iconPosition="start"
            />
            <Tab
              icon={<CalendarMonthOutlined />}
              label="Bloqueio de agenda"
              iconPosition="start"
            />
          </Tabs>

          {/* TAB 0: SEASONAL PRICING */}
          {activeTab === 0 && (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
                  gap: 3,
                  alignItems: 'start',
                }}
              >
                {/* Form to Set Seasonal Price */}
                <SectionCard
                  title="Ajuste por temporada"
                  subtitle="Defina um valor fixo para a diária em cada temporada."
                >
                  {seasons.length === 0 ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        p: 2,
                        bgcolor: 'action.hover',
                        borderRadius: 2,
                      }}
                    >
                      <InfoOutlined sx={{ color: 'text.secondary', fontSize: 20 }} aria-hidden />
                      <Typography variant="body2" color="textSecondary">
                        Nenhuma temporada cadastrada na base.
                      </Typography>
                    </Box>
                  ) : (
                    <FormGrid columns={1} gap={2}>
                      <FormControl fullWidth required size="small">
                        <InputLabel id="season-select-label">Temporada</InputLabel>
                        <Select
                          labelId="season-select-label"
                          value={selectedSeasonId}
                          label="Temporada"
                          onChange={(e) => setSelectedSeasonId(e.target.value)}
                        >
                          {seasons.map((season) => (
                            <MenuItem key={season.id} value={season.id}>
                              {season.nome} ({season.percentualAjuste}% ajuste padrão)
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField
                        label="Preço personalizado (diária)"
                        fullWidth
                        required
                        size="small"
                        type="number"
                        value={seasonPriceValue}
                        onChange={(e) => setSeasonPriceValue(e.target.value)}
                        slotProps={{
                          input: {
                            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                          },
                        }}
                        helperText="Se vazio, o sistema aplicará o percentual de ajuste da temporada sobre o preço base."
                      />

                      <Button
                        variant="contained"
                        onClick={handleSaveSeasonalPrice}
                        disabled={saving}
                        startIcon={<SettingsOutlined />}
                      >
                        Definir preço
                      </Button>
                    </FormGrid>
                  )}
                </SectionCard>

                {/* Seasonal prices table */}
                <SectionCard
                  title="Preços específicos definidos"
                  subtitle="Valores que substituem o percentual padrão da temporada."
                  noPadding
                >
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Temporada</TableCell>
                          <TableCell>Período</TableCell>
                          <TableCell align="right">Preço</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!detailedRoom?.precos || detailedRoom.precos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                              Nenhum preço específico por temporada cadastrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailedRoom.precos.map((price) => (
                            <TableRow key={price.temporadaId} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{price.temporada?.nome}</TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>
                                {dayjs(price.temporada?.dataInicio).format('DD/MM')} a {dayjs(price.temporada?.dataFim).format('DD/MM')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {formatCurrency(price.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              </Box>
            </Box>
          )}

          {/* TAB 1: DATE BLOCKING */}
          {activeTab === 1 && (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
                  gap: 3,
                  alignItems: 'start',
                }}
              >
                {/* Form to Block Date */}
                <SectionCard
                  title="Bloquear nova data"
                  subtitle="Datas bloqueadas ficam indisponíveis para novas reservas."
                >
                  <FormGrid columns={1} gap={2}>
                    <TextField
                      label="Data para bloqueio"
                      fullWidth
                      required
                      size="small"
                      type="date"
                      slotProps={{
                        inputLabel: { shrink: true },
                      }}
                      value={blockDateValue}
                      onChange={(e) => setBlockDateValue(e.target.value)}
                    />

                    <TextField
                      label="Motivo do bloqueio"
                      fullWidth
                      size="small"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ex.: Manutenção, pintura"
                    />

                    <Button
                      variant="contained"
                      color="error"
                      onClick={handleBlockDate}
                      disabled={saving}
                      startIcon={<LockOutlined />}
                    >
                      Bloquear data
                    </Button>
                  </FormGrid>
                </SectionCard>

                {/* List of blocked dates */}
                <SectionCard
                  title="Datas bloqueadas futuras"
                  subtitle="Desbloqueie quando o quarto voltar a ficar disponível."
                >
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box
                        aria-hidden
                        sx={(theme) => ({
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.success.main, 0.9),
                        })}
                      />
                      <Typography variant="caption" color="textSecondary">
                        Disponível
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box
                        aria-hidden
                        sx={(theme) => ({
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.error.main, 0.9),
                        })}
                      />
                      <Typography variant="caption" color="textSecondary">
                        Bloqueado
                      </Typography>
                    </Box>
                  </Box>

                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Data</TableCell>
                          <TableCell>Motivo</TableCell>
                          <TableCell align="center">Desbloquear</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!detailedRoom?.bloqueiosData || detailedRoom.bloqueiosData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                              Nenhuma data bloqueada futuramente.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailedRoom.bloqueiosData.map((block) => (
                            <TableRow key={block.id} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box
                                    aria-hidden
                                    sx={(theme) => ({
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      flexShrink: 0,
                                      bgcolor: alpha(theme.palette.error.main, 0.9),
                                    })}
                                  />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {dayjs(block.data).format('DD/MM/YYYY')}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>{block.motivo || 'Não informado'}</TableCell>
                              <TableCell align="center">
                                <Tooltip title="Remover bloqueio">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    aria-label={`Remover bloqueio de ${dayjs(block.data).format('DD/MM/YYYY')}`}
                                    onClick={() => handleUnblockDate(block.data)}
                                  >
                                    <LockOpenOutlined fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              </Box>
            </Box>
          )}
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button onClick={() => setPricesDialogOpen(false)} variant="contained">
            Fechar
          </Button>
        </FormActions>
      </Dialog>

      {/* Accommodation Type Management Dialog */}
      <Dialog open={typeDialogOpen} onClose={() => setTypeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle component="h2">Tipos de acomodação</DialogTitle>
        <DialogContent>
          <FormSection description="Categorias usadas para agrupar e filtrar os quartos do estabelecimento.">
            <FormGrid columns={1} gap={2}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                }}
              >
                <TextField
                  label="Novo tipo"
                  fullWidth
                  size="small"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Ex.: Chalé rústico"
                />
                <Button
                  variant="contained"
                  onClick={handleCreateType}
                  disabled={savingType || !newTypeName.trim()}
                  startIcon={<AddOutlined />}
                  sx={{ flexShrink: 0 }}
                >
                  {savingType ? 'Adicionando…' : 'Adicionar'}
                </Button>
              </Box>
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
            Tipos cadastrados
          </Typography>

          {roomTypes.length === 0 ? (
            <EmptyState
              title="Nenhum tipo cadastrado"
              description="Crie o primeiro tipo para classificar as acomodações."
              icon={<ClassOutlined />}
              compact
            />
          ) : (
            <Stack spacing={1}>
              {roomTypes.map((type) => (
                <Box
                  key={type.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{type.nome}</Typography>
                  <Tooltip title="Excluir tipo">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Excluir tipo ${type.nome}`}
                      onClick={() => { setTypeToDelete(type); setDeleteTypeDialogOpen(true); }}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Stack>
          )}

          {savingType && <InlineLoading label="Salvando tipo…" sx={{ mt: 2 }} />}
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button onClick={() => setTypeDialogOpen(false)} variant="outlined">
            Fechar
          </Button>
        </FormActions>
      </Dialog>

      {/* Delete Type Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTypeDialogOpen}
        title="Excluir tipo de acomodação"
        description={
          <>
            Excluir <strong>{typeToDelete?.nome}</strong>? Os quartos vinculados a este tipo ficarão sem tipo definido.
          </>
        }
        confirmLabel="Excluir tipo"
        tone="error"
        loading={deletingType}
        onConfirm={handleDeleteTypeConfirm}
        onClose={() => { if (!deletingType) setDeleteTypeDialogOpen(false); }}
      />
    </PageContainer>
  );
}
