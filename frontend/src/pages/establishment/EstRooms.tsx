import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  CircularProgress,
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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Hotel,
  AttachMoney,
  CalendarMonth,
  WarningAmber,
  People,
  Class,
  Lock,
  LockOpen,
  Settings,
  GridOn,
  Info,
} from '@mui/icons-material';
import { establishmentsApi, roomsApi, accommodationTypesApi } from '../../services/api';
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

  // Load Initial Data: User's establishments and room types
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Room Types
        const typesRes = await accommodationTypesApi.getAll();
        setRoomTypes(typesRes.data.data || typesRes.data || []);

        // 2. Fetch Seasons
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
      const res = await roomsApi.getByEstablishment(establishmentId);
      // Backend findByEstablishment returns rooms where active=true, or all if we handle it
      // Let's set rooms
      setRooms(res.data.data || res.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar quartos do estabelecimento');
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEstablishment) {
      fetchRooms(selectedEstablishment.id);
    } else {
      setRooms([]);
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
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Statistics calculations
  const totalRoomsCount = rooms.reduce((sum, r) => sum + r.quantidade, 0);
  const activeRoomsCount = rooms.filter((r) => r.ativo).length;
  const avgPrice = rooms.length > 0
    ? (rooms.reduce((sum, r) => sum + Number(r.precoBase), 0) / rooms.length).toFixed(2)
    : '0,00';
  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacidade * r.quantidade), 0);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Gerenciar Quartos e Acomodações
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cadastre os quartos, gerencie valores por temporada e bloqueie datas da agenda.
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
                  <MenuItem key={est.id} value={est.id}>
                    {est.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAdd}
            disabled={!selectedEstablishment}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
              boxShadow: '0 4px 14px 0 rgba(0, 151, 167, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #00838F, #00ACC1)',
              },
            }}
          >
            Adicionar Quarto
          </Button>
        </Box>
      </Box>

      {/* Stats Summary Panel */}
      {selectedEstablishment && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(0, 151, 167, 0.08)', borderRadius: '12px', color: '#0097A7' }}>
                <Hotel />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Total de Quartos
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {totalRoomsCount}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: '12px', color: '#4CAF50' }}>
                <GridOn />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Categorias Ativas
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {activeRoomsCount}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(255, 112, 67, 0.08)', borderRadius: '12px', color: '#FF7043' }}>
                <AttachMoney />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Preço Médio Base
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  R$ {avgPrice}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ p: 1.5, bgcolor: 'rgba(124, 58, 237, 0.08)', borderRadius: '12px', color: '#7C3AED' }}>
                <People />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Capacidade Hóspedes
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {totalCapacity}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Main Content Area */}
      {roomsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !selectedEstablishment ? (
        <Paper sx={{ p: 6, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Typography color="text.secondary">Nenhum estabelecimento cadastrado ou selecionado.</Typography>
        </Paper>
      ) : rooms.length === 0 ? (
        <Paper sx={{ p: 8, borderRadius: '20px', textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
          <Hotel sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Nenhum quarto cadastrado
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Cadastre os quartos do seu estabelecimento para começar a receber reservas.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAdd}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
            }}
          >
            Adicionar Primeiro Quarto
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {rooms.map((room) => (
            <Grid size={{ xs: 12, md: 6 }} key={room.id}>
              <Card
                sx={{
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 4px 20px 0 rgba(0,0,0,0.015)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 30px 0 rgba(0,0,0,0.04)',
                  },
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {room.nome}
                      </Typography>
                      {room.tipoAcomodacao && (
                        <Chip
                          icon={<Class sx={{ fontSize: '14px !important' }} />}
                          label={room.tipoAcomodacao.nome}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Switch
                        checked={room.ativo}
                        onChange={() => handleToggleActive(room)}
                        color="success"
                        size="small"
                      />
                      <Chip
                        label={room.ativo ? 'Ativo' : 'Inativo'}
                        size="small"
                        color={room.ativo ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, mb: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {room.descricao || 'Sem descrição cadastrada.'}
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Capacidade
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <People sx={{ fontSize: 16, color: 'text.secondary' }} /> {room.capacidade} {room.capacidade === 1 ? 'pessoa' : 'pessoas'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Quantidade
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Hotel sx={{ fontSize: 16, color: 'text.secondary' }} /> {room.quantidade} {room.quantidade === 1 ? 'quarto' : 'quartos'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Preço Base
                      </Typography>
                      <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>
                        R$ {Number(room.precoBase).toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>

                <CardActions
                  sx={{
                    px: 3,
                    py: 2,
                    bgcolor: 'rgba(0,0,0,0.01)',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    justifyContent: 'space-between',
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CalendarMonth />}
                    onClick={() => handleOpenPrices(room)}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: 'primary.main',
                      color: 'primary.main',
                    }}
                  >
                    Preços & Agenda
                  </Button>

                  <Box>
                    <Tooltip title="Editar quarto">
                      <IconButton onClick={() => handleOpenEdit(room)} color="primary" size="small" sx={{ mr: 1 }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover quarto">
                      <IconButton onClick={() => handleOpenDelete(room)} color="error" size="small">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* CRUD Room Dialog */}
      <Dialog
        open={roomDialogOpen}
        onClose={() => !saving && setRoomDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          {selectedRoom ? 'Editar Acomodação' : 'Adicionar Nova Acomodação'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Nome do Quarto"
            fullWidth
            required
            disabled={saving}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Quarto Luxo Casal"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel id="room-type-label">Tipo de Acomodação</InputLabel>
                <Select
                  labelId="room-type-label"
                  value={tipoAcomodacaoId}
                  label="Tipo de Acomodação"
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
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Preço Base (Diária)"
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
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Capacidade de Hóspedes"
                fullWidth
                required
                type="number"
                disabled={saving}
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                helperText="Número máximo de pessoas"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Quantidade de Quartos"
                fullWidth
                required
                type="number"
                disabled={saving}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                helperText="Número total de quartos deste tipo"
              />
            </Grid>
          </Grid>

          <TextField
            label="Descrição detalhada"
            fullWidth
            multiline
            rows={3}
            disabled={saving}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva as comodidades do quarto: ar condicionado, frigobar, tv, etc."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setRoomDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRoom}
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
        open={deleteDialogOpen}
        onClose={() => !saving && setDeleteDialogOpen(false)}
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
            Deseja realmente excluir a acomodação <strong>{roomToDelete?.nome}</strong>? Esta ação é irreversível e removerá todos os preços vinculados.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none', fontWeight: 600 }}>
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

      {/* Prices & Calendar Management Dialog */}
      <Dialog
        open={pricesDialogOpen}
        onClose={() => setPricesDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Agenda e Preços: {selectedRoom?.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Preço base atual: R$ {selectedRoom ? Number(selectedRoom.precoBase).toFixed(2) : '0,00'}
              </Typography>
            </Box>
          </Box>
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
            <Tab icon={<AttachMoney />} label="Preços por Temporada" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab icon={<CalendarMonth />} label="Bloqueio de Agenda" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>

          {/* TAB 0: SEASONAL PRICING */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* Form to Set Seasonal Price */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Settings sx={{ fontSize: 18, color: 'primary.main' }} /> Definir Ajuste Temporada
                    </Typography>

                    {seasons.length === 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                        <Info sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma temporada cadastrada na base.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                          label="Preço Personalizado (Diária)"
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
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                          }}
                        >
                          Definir Preço
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* Seasonal prices table */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Preços específicos definidos
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.015)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Temporada</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Período</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Preço</TableCell>
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
                              <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {dayjs(price.temporada?.dataInicio).format('DD/MM')} a {dayjs(price.temporada?.dataFim).format('DD/MM')}
                              </TableCell>
                              <TableCell color="primary.main" sx={{ fontWeight: 700 }}>
                                R$ {Number(price.valor).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* TAB 1: DATE BLOCKING */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* Form to Block Date */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '12px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Lock sx={{ fontSize: 18, color: 'error.main' }} /> Bloquear Nova Data
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Data para Bloqueio"
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
                        label="Motivo do Bloqueio"
                        fullWidth
                        size="small"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Ex: Manutenção, Pintura"
                      />

                      <Button
                        variant="contained"
                        color="error"
                        onClick={handleBlockDate}
                        disabled={saving}
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 600,
                          bgcolor: 'error.main',
                          '&:hover': {
                            bgcolor: 'error.dark',
                          },
                        }}
                      >
                        Bloquear Data
                      </Button>
                    </Box>
                  </Paper>
                </Grid>

                {/* List of blocked dates */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Datas bloqueadas futuras
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.015)' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Data</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Motivo</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Desbloquear</TableCell>
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
                              <TableCell sx={{ fontWeight: 600 }}>
                                {dayjs(block.data).format('DD/MM/YYYY')}
                              </TableCell>
                              <TableCell>{block.motivo || 'Não informado'}</TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleUnblockDate(block.data)}
                                  title="Remover bloqueio"
                                >
                                  <LockOpen fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setPricesDialogOpen(false)} variant="contained" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
