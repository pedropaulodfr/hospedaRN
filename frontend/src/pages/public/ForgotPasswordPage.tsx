import { useState } from 'react';
import { Box, Typography, Container, Button, TextField, Alert } from '@mui/material';
import { authApi } from '../../services/api';

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
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Esqueci a Senha</Typography>
        
        {success && (
          <Alert severity="success" sx={{ width: '100%' }}>
            Instruções enviadas com sucesso! Verifique sua caixa de entrada.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        <TextField 
          label="E-mail" 
          type="email"
          fullWidth 
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          fullWidth 
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'Enviar Instruções'}
        </Button>
      </Box>
    </Container>
  );
}
