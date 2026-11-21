import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Chip,
  IconButton,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Badge,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  Person,
  Email,
  Phone,
  Security,
  PhotoCamera,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/authStore';
import { usersApi } from '../../services/api';
import { PageContainer, PageHeader, SectionCard, FormActions, toneColor, toneSurface } from '../common';
import type { Tone } from '../../theme/tokens';
import toast from 'react-hot-toast';

interface ProfileSettingsProps {
  fotoPerfil?: string | null;
  estabelecimentoNome?: string;
  onFotoPerfilChange?: (file: File) => void;
  uploadingFoto?: boolean;
  allowEditContact?: boolean;
}

const roleConfig: Record<string, { label: string; tone: Tone }> = {
  ADMIN: { label: 'Administrador / Gestor', tone: 'info' },
  ESTABLISHMENT: { label: 'Estabelecimento', tone: 'secondary' },
  GUEST: { label: 'Hóspede', tone: 'primary' },
};

/** Campo de senha com rótulo visível, autocomplete e alternância de visibilidade. */
function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  disabled,
  autoComplete,
  placeholder,
  helperText,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
}) {
  return (
    <TextField
      label={label}
      type={visible ? 'text' : 'password'}
      fullWidth
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      helperText={helperText}
      autoComplete={autoComplete}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={onToggleVisible}
                edge="end"
                aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
                size="small"
              >
                {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export default function ProfileSettings({
  fotoPerfil,
  estabelecimentoNome,
  onFotoPerfilChange,
  uploadingFoto,
  allowEditContact,
}: ProfileSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, setUser } = useAuthStore();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  // Form states
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Password visibility states
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits[2]}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3)}`;
    return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const [editTelefone, setEditTelefone] = useState(formatPhone(user?.telefone || ''));
  const [savingContact, setSavingContact] = useState(false);

  const handleSaveContact = async () => {
    if (!user) return;

    try {
      setSavingContact(true);
      const raw = editTelefone.replace(/\D/g, '');
      await usersApi.updateMe({ telefone: raw || undefined });
      setUser({ ...user, telefone: raw || undefined });
      toast.success('Contato atualizado com sucesso.');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao atualizar contato.';
      toast.error(msg);
    } finally {
      setSavingContact(false);
    }
  };

  const currentRole =
    (user?.role && roleConfig[user.role]) || { label: user?.role ?? 'Usuário', tone: 'neutral' as Tone };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast.error('Preencha todos os campos do formulário');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A nova senha deve possuir no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('A confirmação de senha não coincide com a nova senha');
      return;
    }

    try {
      setLoading(true);
      await usersApi.changePassword({ senhaAtual, novaSenha });
      toast.success('Senha alterada com sucesso.');

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error(error);
      const msg =
        error.response?.data?.message || 'Erro ao alterar a senha. Verifique os dados inseridos.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const displayName = estabelecimentoNome || user?.nome || '';
  const initials = displayName ? displayName.charAt(0).toUpperCase() : '';

  return (
    <PageContainer maxWidth="reading">
      <PageHeader
        overline="Conta"
        title="Meu perfil"
        subtitle="Gerencie as informações da sua conta e altere sua senha de acesso ao sistema."
      />

      <Grid container spacing={3}>
        {/* Coluna esquerda: identidade + contato */}
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Identidade" subtitle="Dados do titular da conta">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
                    toast.error('Formato não suportado. Use JPG, JPEG, PNG ou WebP.');
                    return;
                  }
                  onFotoPerfilChange?.(file);
                  e.target.value = '';
                }}
              />

              <Tooltip title={onFotoPerfilChange ? 'Alterar foto de perfil' : ''}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    onFotoPerfilChange ? (
                      <Avatar
                        role="button"
                        aria-label="Alterar foto de perfil"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: 'background.paper',
                          '&:hover': { bgcolor: 'primary.dark' },
                        }}
                      >
                        {uploadingFoto ? (
                          <CircularProgress size={14} sx={{ color: 'inherit' }} />
                        ) : (
                          <PhotoCamera sx={{ fontSize: 16 }} />
                        )}
                      </Avatar>
                    ) : null
                  }
                >
                  <Avatar
                    onClick={() => {
                      if (onFotoPerfilChange && !uploadingFoto) fileInputRef.current?.click();
                    }}
                    src={fotoPerfil || undefined}
                    alt={displayName ? `Foto de perfil de ${displayName}` : 'Foto de perfil'}
                    sx={{
                      width: 88,
                      height: 88,
                      fontSize: '1.875rem',
                      fontWeight: 700,
                      color: 'primary.contrastText',
                      cursor: onFotoPerfilChange ? 'pointer' : 'default',
                      bgcolor: fotoPerfil ? 'transparent' : 'primary.main',
                      border: '3px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
                      transition: 'opacity 120ms',
                      '&:hover': onFotoPerfilChange ? { opacity: 0.9 } : undefined,
                    }}
                  >
                    {fotoPerfil ? null : initials || <Person />}
                  </Avatar>
                </Badge>
              </Tooltip>

              <Typography variant="h5" sx={{ mt: 2, fontWeight: 700 }}>
                {displayName || 'Usuário'}
              </Typography>

              <Chip
                label={currentRole.label}
                size="medium"
                sx={{
                  mt: 1,
                  fontWeight: 600,
                  color: toneColor(theme, currentRole.tone),
                  bgcolor: toneSurface(theme, currentRole.tone),
                  border: '1px solid',
                  borderColor: toneSurface(theme, currentRole.tone),
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                <Avatar sx={{ width: 38, height: 38, bgcolor: 'action.hover', color: 'text.secondary' }}>
                  <Email fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', fontWeight: 600 }}>
                    E-mail de acesso
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {user?.email}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                <Avatar sx={{ width: 38, height: 38, bgcolor: 'action.hover', color: 'text.secondary' }}>
                  <Phone fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                    Contato / celular
                  </Typography>
                  {allowEditContact ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editTelefone}
                      onChange={(e) => setEditTelefone(formatPhone(e.target.value))}
                      placeholder="(84) 9 9999-9999"
                      disabled={savingContact}
                      inputMode="numeric"
                      autoComplete="tel-national"
                      slotProps={{ htmlInput: { 'aria-label': 'Telefone de contato' } }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {user?.telefone || 'Não cadastrado'}
                    </Typography>
                  )}
                </Box>
              </Box>

              {allowEditContact && (
                <Button
                  variant="contained"
                  onClick={handleSaveContact}
                  disabled={savingContact}
                  fullWidth
                  startIcon={!savingContact ? <CheckCircleOutlined /> : undefined}
                >
                  {savingContact ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Salvar contato'}
                </Button>
              )}
            </Box>
          </SectionCard>
        </Grid>

        {/* Coluna direita: segurança */}
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Alterar senha"
            subtitle="A nova senha precisa ter no mínimo 6 caracteres."
            action={
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                }}
              >
                <Security fontSize="small" />
              </Box>
            }
          >
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <PasswordField
                  label="Senha atual"
                  value={senhaAtual}
                  onChange={setSenhaAtual}
                  visible={showSenhaAtual}
                  onToggleVisible={() => setShowSenhaAtual((v) => !v)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />

                <PasswordField
                  label="Nova senha"
                  value={novaSenha}
                  onChange={setNovaSenha}
                  visible={showNovaSenha}
                  onToggleVisible={() => setShowNovaSenha((v) => !v)}
                  disabled={loading}
                  autoComplete="new-password"
                  helperText="Mínimo de 6 caracteres"
                  required
                />

                <PasswordField
                  label="Confirmar nova senha"
                  value={confirmarSenha}
                  onChange={setConfirmarSenha}
                  visible={showConfirmarSenha}
                  onToggleVisible={() => setShowConfirmarSenha((v) => !v)}
                  disabled={loading}
                  autoComplete="new-password"
                  required
                />

                <FormActions sx={{ mt: 1 }}>
                  <Button variant="contained" type="submit" disabled={loading} startIcon={!loading ? <Lock /> : undefined}>
                    {loading ? <CircularProgress size={22} sx={{ color: 'inherit' }} /> : 'Salvar alterações'}
                  </Button>
                </FormActions>
              </Box>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
