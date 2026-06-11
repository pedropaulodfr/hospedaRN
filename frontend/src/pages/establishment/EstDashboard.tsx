import { Box, Typography } from '@mui/material';

export default function EstDashboard() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Dashboard do Estabelecimento</Typography>
      <Typography variant="body1" color="text.secondary">Painel de controle do seu estabelecimento.</Typography>
    </Box>
  );
}
