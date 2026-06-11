import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Box, Button, IconButton, Avatar, Menu, MenuItem,
  Container, Drawer, List, ListItem, ListItemButton, ListItemText,
  Typography, Divider, useScrollTrigger, Slide, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon, BeachAccess, Search, Event, Login, PersonAdd,
  AccountCircle, Logout, Dashboard,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const navLinks = [
  { label: 'Início', path: '/' },
  { label: 'Buscar', path: '/busca', icon: <Search fontSize="small" /> },
  { label: 'Eventos', path: '/eventos', icon: <Event fontSize="small" /> },
];

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 10 });

  const handleLogout = () => {
    logout();
    toast.success('Até logo! 👋');
    navigate('/');
    setAnchorEl(null);
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'GUEST') return '/hospede';
    if (user.role === 'ESTABLISHMENT') return '/estabelecimento';
    if (user.role === 'ADMIN') return '/admin';
    return '/';
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={trigger ? 4 : 0}
        sx={{
          bgcolor: trigger ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: trigger ? '1px solid rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ height: 70 }}>
            {/* Logo */}
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0097A7, #FF7043)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <BeachAccess sx={{ color: 'white', fontSize: 20 }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #0097A7, #FF7043)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}
              >
                HospedaRN
              </Typography>
            </Link>

            <Box sx={{ flexGrow: 1 }} />

            {/* Desktop Nav */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mr: 2 }}>
                {navLinks.map((link) => (
                  <Button
                    key={link.path}
                    component={Link}
                    to={link.path}
                    startIcon={link.icon}
                    sx={{
                      color: location.pathname === link.path ? 'primary.main' : 'text.secondary',
                      fontWeight: location.pathname === link.path ? 700 : 500,
                      '&:hover': { bgcolor: 'rgba(0,151,167,0.06)', color: 'primary.main' },
                    }}
                  >
                    {link.label}
                  </Button>
                ))}
              </Box>
            )}

            {/* Auth Actions */}
            {isAuthenticated && user ? (
              <>
                <Button
                  component={Link}
                  to={getDashboardPath()}
                  startIcon={<Dashboard />}
                  variant="outlined"
                  size="small"
                  sx={{ mr: 1, display: { xs: 'none', md: 'flex' } }}
                >
                  Painel
                </Button>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                  <Avatar
                    sx={{
                      width: 36, height: 36,
                      background: 'linear-gradient(135deg, #0097A7, #00BCD4)',
                      fontSize: '0.875rem', fontWeight: 700,
                    }}
                  >
                    {user.nome.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 180, mt: 1 } } }}
                >
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{user.nome}</Typography>
                    <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                  </Box>
                  <Divider />
                  <MenuItem onClick={() => { navigate(getDashboardPath()); setAnchorEl(null); }}>
                    <Dashboard fontSize="small" sx={{ mr: 1 }} /> Meu Painel
                  </MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                    <Logout fontSize="small" sx={{ mr: 1 }} /> Sair
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  component={Link}
                  to="/login"
                  startIcon={<Login />}
                  sx={{ display: { xs: 'none', md: 'flex' } }}
                >
                  Entrar
                </Button>
                <Button
                  component={Link}
                  to="/cadastro"
                  variant="contained"
                  startIcon={<PersonAdd />}
                  sx={{ ml: 1 }}
                >
                  Cadastrar
                </Button>
              </>
            )}

            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ ml: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: 280 } } }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>HospedaRN</Typography>
        </Box>
        <Divider />
        <List>
          {navLinks.map((link) => (
            <ListItem key={link.path} disablePadding>
              <ListItemButton component={Link} to={link.path} onClick={() => setMobileOpen(false)}>
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        {!isAuthenticated && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button component={Link} to="/login" variant="outlined" fullWidth onClick={() => setMobileOpen(false)}>Entrar</Button>
            <Button component={Link} to="/cadastro" variant="contained" fullWidth onClick={() => setMobileOpen(false)}>Cadastrar</Button>
          </Box>
        )}
      </Drawer>

      {/* Page Content */}
      <Box sx={{ mt: '70px' }}>
        <Outlet />
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          mt: 8, py: 6,
          background: 'linear-gradient(135deg, #1A2332 0%, #0d1421 100%)',
          color: 'white',
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
            <BeachAccess sx={{ color: '#0097A7', fontSize: 32 }} />
            <Box>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>HospedaRN</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                As melhores hospedagens do Rio Grande do Norte
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            © {new Date().getFullYear()} HospedaRN. Todos os direitos reservados.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
