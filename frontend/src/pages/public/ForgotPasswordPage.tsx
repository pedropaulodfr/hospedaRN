import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  Link,
} from '@mui/material';
import { Email, ArrowBack, LockResetOutlined } from '@mui/icons-material';
import { authApi } from '../../services/api';
import { PageContainer, Logo } from '../../components/common';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar instruções. Verifique o e-mail informado.');
    } finally {
      setLoading(false);
    }
  };

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
              <LockResetOutlined sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h4" component="h1">
              Recuperar senha
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1, maxWidth: 400 }}>
              Informe o e-mail da sua conta e enviaremos as instruções para criar uma nova senha.
            </Typography>
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 2.5 }}>
              Instruções enviadas com sucesso! Verifique sua caixa de entrada.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2.5 }}>
            <TextField
              id="forgot-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
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

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar instruções'}
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
