import { Box, Typography } from '@mui/material';

export default function GuestFavorites() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Meus Favoritos</Typography>
      <Typography variant="body1" color="text.secondary">Lista de seus estabelecimentos favoritos.</Typography>
    </Box>
  );
}
