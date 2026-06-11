import { Box, Typography } from '@mui/material';

export default function EstRooms() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Gerenciar Quartos</Typography>
      <Typography variant="body1" color="text.secondary">CRUD de quartos de hóspedes.</Typography>
    </Box>
  );
}
