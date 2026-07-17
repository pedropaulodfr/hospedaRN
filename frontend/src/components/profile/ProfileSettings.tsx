import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
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
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/authStore';
import { usersApi } from '../../services/api';
import toast from 'react-hot-toast';

interface ProfileSettingsProps {
  fotoPerfil?: string | null;
  estabelecimentoNome?: string;
  onFotoPerfilChange?: (file: File) => void;
  uploadingFoto?: boolean;
}

export default function ProfileSettings({ fotoPerfil, estabelecimentoNome, onFotoPerfilChange, uploadingFoto }: ProfileSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Form states
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Password visibility states
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  // Role details configuration
  const roleConfig = {
    ADMIN: { label: 'Administrador / Gestor', color: '#7C3AED' },
    ESTABLISHMENT: { label: 'Estabelecimento', color: '#FF7043' },
    GUEST: { label: 'Hóspede', color: '#0097A7' },
  };

  const currentRole = user?.role ? (roleConfig[user.role as keyof typeof roleConfig] || { label: user.role, color: '#666' }) : { label: 'Usuário', color: '#666' };

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
      toast.success('Senha alterada com sucesso! 🎉');
      
      // Clear fields
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Erro ao alterar a senha. Verifique os dados inseridos.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 1 }}>
        Configurações do Meu Perfil
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Gerencie as informações da sua conta e altere sua senha de acesso ao sistema.
      </Typography>

      <Grid container spacing={4}>
        {/* Left Column: Profile Card */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            elevation={0}
            sx={(t) => ({
              p: 4,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
              background: t.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(30,41,59,0.95))'
                : 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.95))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            })}
          >
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
            <Tooltip title={onFotoPerfilChange ? 'Clique para alterar a foto de perfil' : ''}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  onFotoPerfilChange && (
                    <Avatar
                      sx={{
                        width: 30,
                        height: 30,
                        bgcolor: 'primary.main',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      {uploadingFoto ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PhotoCamera sx={{ fontSize: 16 }} />}
                    </Avatar>
                  )
                }
              >
                <Avatar
                  onClick={() => {
                    if (onFotoPerfilChange && !uploadingFoto) {
                      fileInputRef.current?.click();
                    }
                  }}
                  src={fotoPerfil || undefined}
                  sx={{
                    width: 90,
                    height: 90,
                    mb: 2,
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'white',
                    cursor: onFotoPerfilChange ? 'pointer' : 'default',
                    background: fotoPerfil ? undefined : `linear-gradient(135deg, ${currentRole.color}, #9C27B0)`,
                    boxShadow: `0 8px 20px 0 ${currentRole.color}25`,
                    transition: 'opacity 0.2s',
                    '&:hover': onFotoPerfilChange ? { opacity: 0.85 } : undefined,
                  }}
                >
                  {!fotoPerfil && (estabelecimentoNome
                    ? estabelecimentoNome.charAt(0).toUpperCase()
                    : user?.nome
                      ? user.nome.charAt(0).toUpperCase()
                      : <Person />
                  )}
                </Avatar>
              </Badge>
            </Tooltip>

            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, fontFamily: '"Outfit", sans-serif' }}>
              {user?.nome}
            </Typography>

            <Chip
              label={currentRole.label}
              size="medium"
              sx={{
                fontWeight: 600,
                color: currentRole.color,
                bgcolor: `${currentRole.color}15`,
                border: '1px solid',
                borderColor: `${currentRole.color}30`,
                mb: 4,
              }}
            />

            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'left' }}>
                <Avatar sx={(t) => ({ bgcolor: t.palette.mode === 'dark' ? 'rgba(38,198,218,0.15)' : 'rgba(0,151,167,0.06)', color: t.palette.mode === 'dark' ? '#26C6DA' : '#0097A7', width: 40, height: 40 })}>
                  <Email fontSize="small" />
                </Avatar>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                    E-mail do Login
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {user?.email}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'left' }}>
                <Avatar sx={(t) => ({ bgcolor: t.palette.mode === 'dark' ? 'rgba(255,138,101,0.15)' : 'rgba(255,112,67,0.06)', color: t.palette.mode === 'dark' ? '#FF8A65' : '#FF7043', width: 40, height: 40 })}>
                  <Phone fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                    Contato / Celular
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user?.telefone || 'Não cadastrado'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Change Password Card */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            elevation={0}
            component="form"
            onSubmit={handleSubmit}
            sx={{
              p: 4,
              borderRadius: '24px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3.5 }}>
              <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 36, height: 36 }}>
                <Security fontSize="small" />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                Alteração de Senha
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Senha Atual"
                type={showSenhaAtual ? 'text' : 'password'}
                fullWidth
                required
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Insira sua senha atual"
                disabled={loading}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'text.secondary', opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowSenhaAtual(!showSenhaAtual)} edge="end">
                          {showSenhaAtual ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <TextField
                label="Nova Senha"
                type={showNovaSenha ? 'text' : 'password'}
                fullWidth
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'text.secondary', opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowNovaSenha(!showNovaSenha)} edge="end">
                          {showNovaSenha ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <TextField
                label="Confirmar Nova Senha"
                type={showConfirmarSenha ? 'text' : 'password'}
                fullWidth
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                disabled={loading}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'text.secondary', opacity: 0.7 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmarSenha(!showConfirmarSenha)} edge="end">
                          {showConfirmarSenha ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <Button
                variant="contained"
                type="submit"
                disabled={loading}
                sx={{
                  mt: 1,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                  background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                  boxShadow: '0 4px 14px 0 rgba(0, 151, 167, 0.3)',
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Salvar Alterações'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
