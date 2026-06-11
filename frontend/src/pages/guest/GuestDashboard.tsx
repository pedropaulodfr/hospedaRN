import { Box, Typography } from '@mui/material';

export default function GuestDashboard() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Dashboard do Hóspede</Typography>
      <Typography variant="body1" color="text.secondary">Seu dashboard de hóspede.</Typography>
    </Box>
  );
}
