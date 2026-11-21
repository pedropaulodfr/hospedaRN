import { useState } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  CircularProgress,
  Divider,
  Link,
  Stack,
  alpha,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Logo } from '../../components/common';
import { layout } from '../../theme/tokens';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/** Destaques da marca exibidos no painel lateral (fatos do produto, sem métricas inventadas). */
const brandHighlights = [
  'Pousadas, hotéis e chalés em todo o Rio Grande do Norte',
  'Solicite a reserva e acompanhe a aprovação pelo painel',
  'Pagamento por Pix, boleto ou cartão',
];

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

      toast.success(`Bem-vindo de volta, ${user.nome}!`);

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
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
        minHeight: { lg: `calc(100vh - ${layout.appBar}px)` },
        bgcolor: 'background.default',
      }}
    >
      {/* ================= PAINEL DE MARCA (desktop) ================= */}
      <Box
        component="aside"
        aria-label="Sobre o HospedaRN"
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          bgcolor: 'primary.dark',
          color: 'primary.contrastText',
          position: 'relative',
          overflow: 'hidden',
          p: { lg: 6, xl: 8 },
        }}
      >
        {/* Textura sutil: dois círculos em `alpha`, sem gradiente nem hex. */}
        <Box
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            width: 380,
            height: 380,
            borderRadius: '50%',
            top: -140,
            right: -120,
            border: `1px solid ${alpha(t.palette.primary.contrastText, 0.16)}`,
            bgcolor: alpha(t.palette.primary.contrastText, 0.04),
            pointerEvents: 'none',
          })}
        />
        <Box
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            width: 240,
            height: 240,
            borderRadius: '50%',
            bottom: -90,
            left: -60,
            border: `1px solid ${alpha(t.palette.primary.contrastText, 0.12)}`,
            pointerEvents: 'none',
          })}
        />

        <Box sx={{ position: 'relative' }}>
          <Logo size={40} onDark to="/" />
        </Box>

        <Box sx={{ position: 'relative' }}>
          <Typography
            variant="overline"
            component="p"
            sx={{ color: 'inherit', opacity: 0.72, mb: 1.5 }}
          >
            Hospedagens no Rio Grande do Norte
          </Typography>
          <Typography
            variant="h3"
            component="p"
            sx={{ color: 'inherit', maxWidth: 460, letterSpacing: '-0.02em' }}
          >
            Seu próximo litoral começa com uma boa reserva.
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'inherit', opacity: 0.82, mt: 2.5, maxWidth: 420 }}
          >
            Encontre onde ficar e acompanhe cada solicitação em um só lugar.
          </Typography>

          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {brandHighlights.map((highlight) => (
              <Stack key={highlight} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <CheckCircleOutlined
                  aria-hidden
                  sx={{ fontSize: 20, color: 'inherit', opacity: 0.85, mt: 0.25, flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.88 }}>
                  {highlight}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.6, position: 'relative' }}>
          Rio Grande do Norte · Brasil
        </Typography>
      </Box>

      {/* ================= FORMULÁRIO ================= */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
          py: { xs: 4, md: 6, lg: 8 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          {/* Marca no topo (mobile/tablet) */}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, justifyContent: 'center', mb: 3 }}>
            <Logo size={38} to="/" />
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" component="p" color="primary">
                  Acessar conta
                </Typography>
                <Typography variant="h4" component="h1" sx={{ mt: 0.5 }}>
                  Entrar
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Informe seu e-mail e senha para acessar o HospedaRN.
                </Typography>
              </Box>

              <Box
                component="form"
                noValidate
                onSubmit={handleSubmit(onSubmit)}
                sx={{ display: 'grid', gap: 2.5 }}
              >
                <TextField
                  id="login-email"
                  {...register('email')}
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  variant="outlined"
                  fullWidth
                  autoFocus
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email aria-hidden sx={{ color: 'text.secondary', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Box>
                  <TextField
                    id="login-senha"
                    {...register('senha')}
                    label="Senha"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    variant="outlined"
                    fullWidth
                    error={!!errors.senha}
                    helperText={errors.senha?.message}
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
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Box sx={{ textAlign: 'right', mt: 1 }}>
                    <Link component={RouterLink} to="/recuperar-senha" variant="body2" sx={{ fontWeight: 600 }}>
                      Esqueceu a senha?
                    </Link>
                  </Box>
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                Não tem uma conta?{' '}
                <Link component={RouterLink} to="/cadastro" variant="body2" sx={{ fontWeight: 600 }}>
                  Criar conta
                </Link>
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
