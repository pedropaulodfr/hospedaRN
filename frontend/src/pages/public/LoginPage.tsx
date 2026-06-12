import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Typography,
  Container,
  Button,
  TextField,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, BeachAccess, Email, Lock } from '@mui/icons-material';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const setAuth = useAuthStore((state) => state.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const response = await authApi.login(data);
      const { usuario, accessToken, refreshToken } = response.data.data;

      // Map PT-BR profile to English role for frontend compatibility
      let role: 'GUEST' | 'ESTABLISHMENT' | 'ADMIN' = 'GUEST';
      if (usuario.perfil === 'ADMIN') role = 'ADMIN';
      else if (usuario.perfil === 'ESTABELECIMENTO') role = 'ESTABLISHMENT';
      else role = 'GUEST';

      const user = {
        ...usuario,
        role,
      };

      // Update Zustand auth store
      setAuth(user, accessToken, refreshToken);

      toast.success(`Bem-vindo de volta, ${user.nome}! 👋`);

      // Redirect based on role
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'ESTABLISHMENT') {
        navigate('/estabelecimento');
      } else {
        navigate(redirectUrl || '/hospede');
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Falha ao realizar login. Verifique suas credenciais.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: 12 }}>
      <Card sx={{ borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0097A7, #FF7043)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BeachAccess sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                Entrar
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Acesse sua conta do HospedaRN
              </Typography>
            </Box>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                {...register('email')}
                label="E-mail"
                variant="outlined"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                {...register('senha')}
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                fullWidth
                error={!!errors.senha}
                helperText={errors.senha?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Box sx={{ textAlign: 'right', mt: -1 }}>
                <Link
                  to="/recuperar-senha"
                  style={{
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#0097A7',
                  }}
                >
                  Esqueceu a senha?
                </Link>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 151, 167, 0.25)',
                  },
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
              </Button>
            </Box>
          </form>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Não tem uma conta?{' '}
              <Link
                to="/cadastro"
                style={{
                  textDecoration: 'none',
                  fontWeight: 600,
                  color: '#0097A7',
                }}
              >
                Cadastre-se
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
