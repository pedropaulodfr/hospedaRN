import { Box, Typography, Container, Button, TextField } from '@mui/material';

export default function RegisterPage() {
  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Cadastrar</Typography>
        <TextField label="Nome" fullWidth />
        <TextField label="E-mail" fullWidth />
        <TextField label="Senha" type="password" fullWidth />
        <Button variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Cadastrar</Button>
      </Box>
    </Container>
  );
}
