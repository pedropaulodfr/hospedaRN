import { useState } from 'react';
import { Box, Typography, Container, Button, TextField, Alert } from '@mui/material';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
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
      <Container maxWidth="xs" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Link de recuperação inválido. Verifique o e-mail recebido.
        </Alert>
        <Button component={Link} to="/login" variant="outlined" fullWidth>
          Voltar para o Login
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Criar Nova Senha</Typography>
        
        {success && (
          <Alert severity="success" sx={{ width: '100%' }}>
            Senha redefinida com sucesso! Redirecionando para o login...
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        <TextField 
          label="Nova Senha" 
          type="password"
          fullWidth 
          required
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          disabled={loading || success}
        />
        <TextField 
          label="Confirmar Nova Senha" 
          type="password"
          fullWidth 
          required
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          disabled={loading || success}
        />
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          fullWidth 
          sx={{ mt: 2 }}
          disabled={loading || success}
        >
          {loading ? 'Redefinindo...' : 'Redefinir Senha'}
        </Button>
      </Box>
    </Container>
  );
}
