import { Box, Typography } from '@mui/material';

export default function EstReservations() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Reservas Recebidas</Typography>
      <Typography variant="body1" color="text.secondary">Gerenciamento de reservas recebidas.</Typography>
    </Box>
  );
}
