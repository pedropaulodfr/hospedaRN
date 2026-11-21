import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Avatar,
  Card,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
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
  Checkbox,
} from '@mui/material';
import {
  Add,
  DeleteOutlined,
  EditOutlined,
  PeopleOutlined,
  PersonAdd,
} from '@mui/icons-material';
import {
  ConfirmDialog,
  DataToolbar,
  DataToolbarGroup,
  EmptySearchIcon,
  EmptyState,
  ErrorState,
  FormActions,
  FormGrid,
  FormSection,
  PageContainer,
  PageHeader,
  SearchField,
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
  { value: 'EST_DASHBOARD', label: 'Dashboard' },
  { value: 'EST_PHOTOS', label: 'Fotos' },
  { value: 'EST_PRICES', label: 'Preços' },
  { value: 'EST_REPORTS', label: 'Relatórios' },
  { value: 'EST_RESERVATIONS', label: 'Reservas' },
  { value: 'EST_ROOMS', label: 'Quartos' },
];

const SUB_PERFIS = ['Gerente', 'Recepcionista', 'Limpeza'];

function permissionLabel(value: string) {
  return PERMISSIONS_LIST.find((p) => p.value === value)?.label ?? value;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export default function EstUsers() {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busca, setBusca] = useState('');
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

  const filteredUsers = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.nome} ${u.email} ${u.subPerfil ?? ''} ${(u.permissoes || []).join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, busca]);

  const renderPermissoes = (user: SubUser) => {
    const lista = user.permissoes || [];
    if (lista.length === 0) {
      return (
        <Typography variant="caption" color="textSecondary">
          Nenhuma permissão
        </Typography>
      );
    }
    const visiveis = lista.slice(0, 2);
    return (
      <Tooltip title={lista.map(permissionLabel).join(', ')}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
          {visiveis.map((p) => (
            <Chip key={p} size="small" label={permissionLabel(p)} variant="outlined" />
          ))}
          {lista.length > visiveis.length && (
            <Chip size="small" label={`+${lista.length - visiveis.length}`} variant="outlined" />
          )}
        </Box>
      </Tooltip>
    );
  };

  const renderAcoes = (user: SubUser) => (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: { xs: 'flex-end', md: 'center' } }}>
      <Tooltip title="Editar membro">
        <IconButton
          size="small"
          color="primary"
          aria-label={`Editar ${user.nome}`}
          onClick={() => handleOpenEdit(user)}
        >
          <EditOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Excluir membro">
        <IconButton
          size="small"
          color="error"
          aria-label={`Excluir ${user.nome}`}
          onClick={() => handleDeleteClick(user)}
        >
          <DeleteOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        overline="Estabelecimento"
        title="Equipe"
        subtitle="Gerencie quem tem acesso a este estabelecimento, o perfil de cada pessoa e as telas permitidas."
        icon={<PeopleOutlined />}
        actions={
          <Button variant="contained" startIcon={<PersonAdd />} onClick={handleOpenAdd}>
            Novo membro
          </Button>
        }
      />

      <DataToolbar>
        <DataToolbarGroup>
          <SearchField
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por nome, e-mail ou perfil"
            width={360}
          />
        </DataToolbarGroup>
        {!loading && !error && (
          <Typography variant="body2" color="textSecondary">
            {filteredUsers.length === 1
              ? '1 membro'
              : `${filteredUsers.length} membros`}
          </Typography>
        )}
      </DataToolbar>

      {loading ? (
        <Card sx={{ p: 3 }}>
          <TableSkeleton rows={5} columns={5} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar a equipe"
            description="Falha ao buscar os membros do estabelecimento. Verifique sua conexão e tente novamente."
            onRetry={fetchUsers}
          />
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum membro cadastrado"
            description="Convide recepcionistas, gerentes ou equipe de limpeza para acessar o painel do estabelecimento."
            icon={<PeopleOutlined />}
            action={
              <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
                Convidar primeiro membro
              </Button>
            }
          />
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum membro encontrado"
            description={`Não encontramos membros para "${busca}". Tente outro nome, e-mail ou perfil.`}
            icon={EmptySearchIcon}
            compact
            action={
              <Button variant="outlined" onClick={() => setBusca('')}>
                Limpar busca
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Tabela — telas médias e grandes */}
          <Card sx={{ display: { xs: 'none', md: 'block' }, overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Membro</TableCell>
                    <TableCell>Perfil</TableCell>
                    <TableCell>Permissões</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                          <Avatar sx={{ width: 36, height: 36, fontSize: '0.875rem', flexShrink: 0 }}>
                            {iniciais(user.nome)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {user.nome}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" noWrap component="p">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={user.subPerfil || 'Membro'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{renderPermissoes(user)}</TableCell>
                      <TableCell>
                        <StatusChip status={user.ativo ? 'ATIVO' : 'INATIVO'} />
                      </TableCell>
                      <TableCell align="center">{renderAcoes(user)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {/* Cards — mobile */}
          <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {filteredUsers.map((user) => (
              <Card key={user.id} sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Avatar sx={{ width: 40, height: 40, fontSize: '0.9375rem', flexShrink: 0 }}>
                    {iniciais(user.nome)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }} noWrap>
                      {user.nome}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" noWrap component="p">
                      {user.email}
                    </Typography>
                  </Box>
                  <StatusChip status={user.ativo ? 'ATIVO' : 'INATIVO'} />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  <Chip label={user.subPerfil || 'Membro'} size="small" variant="outlined" />
                  {(user.permissoes || []).map((p) => (
                    <Chip key={p} label={permissionLabel(p)} size="small" variant="outlined" />
                  ))}
                  {(user.permissoes || []).length === 0 && (
                    <Typography variant="caption" color="textSecondary">
                      Nenhuma permissão
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                  {renderAcoes(user)}
                </Box>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {/* Convidar / editar membro */}
      <Dialog
        open={openDialog}
        onClose={() => { if (!saving) setOpenDialog(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="h2">
          {selectedUser ? 'Editar membro da equipe' : 'Convidar novo membro'}
        </DialogTitle>
        <DialogContent>
          <FormSection description="Dados de acesso e responsabilidades do membro dentro do estabelecimento.">
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
                  !selectedUser
                    ? 'O membro receberá um link neste e-mail para criar a senha.'
                    : 'O e-mail de login não pode ser alterado.'
                }
              />
              <FormControl fullWidth>
                <InputLabel id="subperfil-label">Perfil</InputLabel>
                <Select
                  labelId="subperfil-label"
                  value={subPerfil}
                  label="Perfil"
                  onChange={(e) => setSubPerfil(e.target.value)}
                >
                  {SUB_PERFIS.map((perfil) => (
                    <MenuItem key={perfil} value={perfil}>
                      {perfil}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </FormGrid>
          </FormSection>

          <Divider sx={{ my: 3 }} />

          <FormSection
            title="Telas permitidas"
            description="Escolha o que este membro pode acessar no painel do estabelecimento."
          >
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <FormGroup>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    columnGap: 2,
                  }}
                >
                  {PERMISSIONS_LIST.map((perm) => (
                    <FormControlLabel
                      key={perm.value}
                      control={
                        <Checkbox
                          size="small"
                          checked={permissoes.includes(perm.value)}
                          onChange={() => handlePermissionChange(perm.value)}
                        />
                      }
                      label={<Typography variant="body2">{perm.label}</Typography>}
                      sx={{ minHeight: 44, m: 0, alignItems: 'center' }}
                    />
                  ))}
                </Box>
              </FormGroup>
            </Box>
          </FormSection>
        </DialogContent>
        <FormActions sx={{ px: 3, pb: 2.5, mt: 0 }}>
          <Button color="inherit" onClick={() => setOpenDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : selectedUser ? 'Salvar alterações' : 'Enviar convite'}
          </Button>
        </FormActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir membro"
        description={
          <>
            Excluir <strong>{userToDelete?.nome}</strong> da equipe? O acesso será revogado imediatamente e esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir membro"
        tone="error"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => { if (!deleting) setConfirmDeleteOpen(false); }}
      />
    </PageContainer>
  );
}
