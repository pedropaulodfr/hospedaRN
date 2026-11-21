import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
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
import { Add, Delete, Edit, ManageAccounts, Person } from '@mui/icons-material';
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
  { value: 'ADMIN_DASHBOARD', label: 'Dashboard' },
  { value: 'ADMIN_CITIES', label: 'Cidades' },
  { value: 'ADMIN_ESTABLISHMENTS', label: 'Estabelecimentos' },
  { value: 'ADMIN_EVENTS', label: 'Eventos' },
  { value: 'ADMIN_REPORTS', label: 'Relatórios' },
  { value: 'ADMIN_USERS', label: 'Usuários' },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('all');
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
  const [subPerfil, setSubPerfil] = useState('Operacional');
  const [permissoes, setPermissoes] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await subUsersApi.getAll();
      setUsers(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError(true);
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
    setSubPerfil('Operacional');
    setPermissoes([]);
    setOpenDialog(true);
  };

  const handleOpenEdit = (user: SubUser) => {
    setSelectedUser(user);
    setNome(user.nome);
    setEmail(user.email);
    setSubPerfil(user.subPerfil || 'Operacional');
    setPermissoes(user.permissoes || []);
    setOpenDialog(true);
  };

  const handlePermissionChange = (value: string) => {
    setPermissoes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
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
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erro ao salvar usuário';
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
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir usuário');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setUserToDelete(null);
  };

  const term = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (perfilFilter !== 'all' && (user.subPerfil || 'Operacional') !== perfilFilter) return false;
    if (!term) return true;
    return (
      user.nome.toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    );
  });

  return (
    <PageContainer maxWidth="content">
      <PageHeader
        overline="Gestão"
        title="Usuários gestores"
        subtitle="Gerencie os usuários que têm acesso administrativo ao sistema e suas permissões."
        icon={<ManageAccounts />}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
            Novo usuário
          </Button>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome ou e-mail"
            width={320}
          />
          <TextField
            select
            size="small"
            label="Perfil"
            value={perfilFilter}
            onChange={(e) => setPerfilFilter(e.target.value)}
            sx={{ minWidth: 180, maxWidth: 240 }}
          >
            <MenuItem value="all">Todos os perfis</MenuItem>
            <MenuItem value="Operacional">Operacional</MenuItem>
            <MenuItem value="Admin">Administrador</MenuItem>
          </TextField>
        </DataToolbarGroup>
        <Typography variant="caption" color="textSecondary">
          {filteredUsers.length} de {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
        </Typography>
      </DataToolbar>

      <SectionCard noPadding>
        {loading ? (
          <Box sx={{ p: 2.5 }}>
            <TableSkeleton rows={6} columns={6} />
          </Box>
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar os usuários"
            description="Ocorreu uma falha ao buscar os usuários gestores."
            onRetry={fetchUsers}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<ManageAccounts />}
            title="Nenhum usuário gestor cadastrado"
            description="Crie o primeiro usuário com acesso ao painel administrativo."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
                Novo usuário
              </Button>
            }
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={EmptySearchIcon}
            title="Nenhum usuário encontrado"
            description="Ajuste a busca ou o filtro de perfil para encontrar o usuário desejado."
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch('');
                  setPerfilFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Perfil</TableCell>
                  <TableCell>Permissões</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, fontSize: '0.875rem' }}>
                          <Person sx={{ fontSize: 18 }} />
                        </Avatar>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {user.nome}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={user.subPerfil || 'Gestor'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {user.permissoes?.length > 0 ? (
                        <Tooltip title={user.permissoes.join(', ')}>
                          <Typography variant="body2">
                            {user.permissoes.length}{' '}
                            {user.permissoes.length === 1 ? 'permissão' : 'permissões'}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Nenhuma
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof user.ativo === 'boolean' ? (
                        <StatusChip status={user.ativo ? 'ATIVO' : 'INATIVO'} />
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            aria-label={`Editar usuário ${user.nome}`}
                            onClick={() => handleOpenEdit(user)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Excluir usuário ${user.nome}`}
                            onClick={() => handleDeleteClick(user)}
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
        <DialogTitle>{selectedUser ? 'Editar usuário' : 'Cadastrar usuário'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2.5 }}>
            {selectedUser
              ? 'O e-mail de acesso não pode ser alterado depois da criação da conta.'
              : 'O usuário recebe um e-mail com o link para definir a própria senha.'}
          </Typography>

          <FormSection title="Dados do usuário">
            <FormGrid columns={2}>
              <TextField
                label="Nome completo"
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
                helperText={
                  selectedUser
                    ? 'E-mail não editável'
                    : 'Um link de definição de senha será enviado para este endereço.'
                }
              />
              <FormSpan span={2}>
                <FormControl fullWidth>
                  <InputLabel>Perfil</InputLabel>
                  <Select
                    value={subPerfil}
                    label="Perfil"
                    onChange={(e) => setSubPerfil(e.target.value)}
                  >
                    <MenuItem value="Operacional">Operacional</MenuItem>
                    <MenuItem value="Admin">Administrador</MenuItem>
                  </Select>
                </FormControl>
              </FormSpan>
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 2.5 }} />

          <FormSection
            title="Telas permitidas"
            description="Defina quais áreas do painel este usuário pode acessar."
          >
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  columnGap: 2,
                  rowGap: 0.5,
                }}
              >
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
                  />
                ))}
              </Box>
            </Paper>
          </FormSection>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} loading={saving}>
            {selectedUser ? 'Salvar alterações' : 'Cadastrar usuário'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir usuário"
        description={
          <>
            Deseja excluir o usuário <strong>{userToDelete?.nome}</strong>? O acesso dele será
            revogado imediatamente.
          </>
        }
        confirmLabel="Excluir usuário"
        loading={deleting}
        tone="error"
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
      />
    </PageContainer>
  );
}
