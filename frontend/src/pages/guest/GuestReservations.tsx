import { Box, Typography } from '@mui/material';

export default function GuestReservations() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Minhas Reservas</Typography>
      <Typography variant="body1" color="text.secondary">Lista de suas reservas.</Typography>
    </Box>
  );
}
