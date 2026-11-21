import { useState } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Lock,
  LockOutlined,
  Visibility,
  VisibilityOff,
  ArrowBack,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { PageContainer, Logo } from '../../components/common';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Token de recuperação inválido ou ausente.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await authApi.resetPassword({ token, novaSenha });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao redefinir a senha. O link pode estar expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <PageContainer maxWidth="narrow">
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Logo size={36} to="/" />
        </Box>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              Link de recuperação inválido. Verifique o e-mail recebido.
            </Alert>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              fullWidth
              startIcon={<ArrowBack />}
            >
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="narrow">
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Logo size={36} to="/" />
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
            <Box
              aria-hidden
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.selected',
                color: 'primary.main',
                mb: 2,
              }}
            >
              <LockOutlined sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h4" component="h1">
              Criar nova senha
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1, maxWidth: 400 }}>
              Defina uma nova senha para acessar sua conta. Use pelo menos 6 caracteres.
            </Typography>
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 2.5 }}>
              Senha redefinida com sucesso! Redirecionando para o login...
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2.5 }}>
            <TextField
              id="reset-nova-senha"
              label="Nova senha"
              type={showNovaSenha ? 'text' : 'password'}
              autoComplete="new-password"
              fullWidth
              required
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              disabled={loading || success}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNovaSenha(!showNovaSenha)}
                        edge="end"
                        aria-label={showNovaSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showNovaSenha ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              id="reset-confirmar-senha"
              label="Confirmar nova senha"
              type={showConfirmarSenha ? 'text' : 'password'}
              autoComplete="new-password"
              fullWidth
              required
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              disabled={loading || success}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                        edge="end"
                        aria-label={
                          showConfirmarSenha ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'
                        }
                      >
                        {showConfirmarSenha ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={loading || success}
              aria-busy={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Redefinir senha'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link
              component={RouterLink}
              to="/login"
              variant="body2"
              sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <ArrowBack aria-hidden sx={{ fontSize: 18 }} />
              Voltar para o login
            </Link>
          </Box>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
