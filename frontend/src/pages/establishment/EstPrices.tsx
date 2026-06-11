import { Box, Typography } from '@mui/material';

export default function EstPrices() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Temporadas e Preços</Typography>
      <Typography variant="body1" color="text.secondary">Definição de tarifas sazonais.</Typography>
    </Box>
  );
}
