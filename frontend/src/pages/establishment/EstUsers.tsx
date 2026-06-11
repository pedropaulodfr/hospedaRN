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
  CircularProgress,
  Tooltip,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete, Person, WarningAmber } from '@mui/icons-material';
import { subUsersApi } from '../../services/api';
import toast from 'react-hot-toast';

interface SubUser {
  id: string;
  nome: string;
  email: string;
  subPerfil?: string;
  permissoes: string[];
  ativo: boolean;
  criadoEm: string;
}

const PERMISSIONS_LIST = [
  { value: 'EST_DASHBOARD', label: 'Dashboard' },
  { value: 'EST_PHOTOS', label: 'Fotos' },
  { value: 'EST_PRICES', label: 'Preços' },
  { value: 'EST_REPORTS', label: 'Relatórios' },
  { value: 'EST_RESERVATIONS', label: 'Reservas' },
  { value: 'EST_ROOMS', label: 'Quartos' },
];

export default function EstUsers() {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubUser | null>(null);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SubUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [subPerfil, setSubPerfil] = useState('Recepcionista');
  const [permissoes, setPermissoes] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await subUsersApi.getAll();
      setUsers(res.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setSelectedUser(null);
    setNome('');
    setEmail('');
    setSubPerfil('Recepcionista');
    setPermissoes([]);
    setOpenDialog(true);
  };

  const handleOpenEdit = (user: SubUser) => {
    setSelectedUser(user);
    setNome(user.nome);
    setEmail(user.email);
    setSubPerfil(user.subPerfil || 'Recepcionista');
    setPermissoes(user.permissoes || []);
    setOpenDialog(true);
  };

  const handlePermissionChange = (value: string) => {
    setPermissoes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!nome || !email) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      nome,
      email,
      subPerfil,
      permissoes,
    };

    try {
      setSaving(true);
      if (selectedUser) {
        await subUsersApi.update(selectedUser.id, { nome, subPerfil, permissoes });
        toast.success('Usuário atualizado com sucesso');
      } else {
        await subUsersApi.create(payload);
        toast.success('Usuário criado! Um e-mail será enviado para definição de senha.');
      }
      setOpenDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao salvar usuário';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (user: SubUser) => {
    setUserToDelete(user);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      setDeleting(true);
      await subUsersApi.delete(userToDelete.id);
      toast.success('Usuário excluído com sucesso');
      setConfirmDeleteOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 0.5 }}>
            Equipe do Estabelecimento
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie os usuários que têm acesso a este estabelecimento.
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
          Novo Membro
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
                  <TableCell sx={{ fontWeight: 600 }}>E-mail</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Perfil</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Permissões</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      Nenhum membro da equipe cadastrado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(0,151,167,0.08)' }}>
                            <Person sx={{ fontSize: 18, color: 'primary.main' }} />
                          </Avatar>
                          {user.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip label={user.subPerfil || 'Membro'} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {user.permissoes?.length > 0 ? (
                          <Tooltip title={user.permissoes.join(', ')}>
                            <Typography variant="body2">{user.permissoes.length} permissões</Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Nenhuma</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton onClick={() => handleOpenEdit(user)} color="primary" size="small" sx={{ mr: 1 }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton onClick={() => handleDeleteClick(user)} color="error" size="small">
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
          {selectedUser ? 'Editar Membro da Equipe' : 'Cadastrar Novo Membro'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="Nome Completo"
            fullWidth
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            required
            disabled={!!selectedUser}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText={!selectedUser ? "O membro receberá um link neste e-mail para criar a sua senha." : ""}
          />
          <FormControl fullWidth>
            <InputLabel>Perfil</InputLabel>
            <Select
              value={subPerfil}
              label="Perfil"
              onChange={(e) => setSubPerfil(e.target.value)}
            >
              <MenuItem value="Gerente">Gerente</MenuItem>
              <MenuItem value="Recepcionista">Recepcionista</MenuItem>
              <MenuItem value="Limpeza">Limpeza</MenuItem>
            </Select>
          </FormControl>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Telas Permitidas</Typography>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <FormGroup row>
                {PERMISSIONS_LIST.map((perm) => (
                  <FormControlLabel
                    key={perm.value}
                    control={
                      <Checkbox
                        checked={permissoes.includes(perm.value)}
                        onChange={() => handlePermissionChange(perm.value)}
                      />
                    }
                    label={perm.label}
                    sx={{ width: '45%' }}
                  />
                ))}
              </FormGroup>
            </Paper>
          </Box>
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
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber sx={{ color: 'error.main' }} />
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deseja realmente excluir o membro <strong>{userToDelete?.nome}</strong>? O acesso dele será revogado imediatamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button
            onClick={() => setConfirmDeleteOpen(false)}
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
