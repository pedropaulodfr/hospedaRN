import { Box, Typography, Container } from '@mui/material';

export default function EventsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>Eventos</Typography>
        <Typography variant="body1" color="text.secondary">Página de eventos em desenvolvimento.</Typography>
      </Box>
    </Container>
  );
}
