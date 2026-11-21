import { useState } from 'react';
import { Outlet, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Container,
  useScrollTrigger,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search,
  Event,
  Login,
  PersonAdd,
  Logout,
  Dashboard,
  DarkMode,
  LightMode,
  Close,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Logo } from '../common/Logo';
import { layout as layoutTokens , darkSurface} from '../../theme/tokens';
import toast from 'react-hot-toast';

const navLinks = [
  { label: 'Início', path: '/', icon: <KeyboardArrowRight fontSize="small" /> },
  { label: 'Buscar hospedagens', path: '/busca', icon: <Search fontSize="small" /> },
  { label: 'Eventos', path: '/eventos', icon: <Event fontSize="small" /> },
];

const footerNav = [
  { label: 'Início', path: '/' },
  { label: 'Buscar hospedagens', path: '/busca' },
  { label: 'Eventos', path: '/eventos' },
];

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 8 });

  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleMode);

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'GUEST') return '/hospede';
    if (user.role === 'ESTABLISHMENT') return '/estabelecimento';
    if (user.role === 'ADMIN') return '/admin';
    return '/';
  };

  const handleLogout = () => {
    logout();
    toast.success('Sessão encerrada.');
    navigate('/');
    setAnchorEl(null);
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Atalho de teclado para o conteúdo (acessibilidade) */}
      <Box
        component="a"
        href="#conteudo-principal"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 2000,
          bgcolor: 'background.paper',
          color: 'primary.main',
          px: 2,
          py: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          fontWeight: 600,
          '&:focus': { left: 16 },
        }}
      >
        Ir para o conteúdo
      </Box>

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: alpha(theme.palette.background.paper, trigger ? 0.94 : 0.86),
          borderBottom: `1px solid ${trigger ? theme.palette.divider : 'transparent'}`,
          transition: `background-color 180ms, border-color 180ms`,
        }}
      >
        <Container maxWidth={false} sx={{ maxWidth: layoutTokens.maxContent + 64, px: { xs: 2, sm: 3, md: 4 } }}>
          <Toolbar disableGutters sx={{ height: layoutTokens.appBar, minHeight: `${layoutTokens.appBar}px`, gap: 1 }}>
            <Logo size={36} />

            <Box sx={{ flexGrow: 1 }} />

            {/* Navegação desktop */}
            <Box component="nav" aria-label="Navegação principal" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, alignItems: 'center', mr: 1 }}>
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Button
                    key={link.path}
                    component={RouterLink}
                    to={link.path}
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      px: 2,
                      minHeight: 40,
                      color: active ? 'primary.main' : 'text.secondary',
                      fontWeight: active ? 700 : 500,
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.09) : 'transparent',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main' },
                    }}
                  >
                    {link.label}
                  </Button>
                );
              })}
            </Box>

            <IconButton
              onClick={toggleTheme}
              aria-label={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              sx={{ color: 'text.secondary', ml: { xs: 'auto', md: 0 } }}
            >
              {themeMode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>

            {isAuthenticated && user ? (
              <>
                <Button
                  component={RouterLink}
                  to={getDashboardPath()}
                  startIcon={<Dashboard />}
                  variant="outlined"
                  size="small"
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, ml: 0.5 }}
                >
                  Meu painel
                </Button>
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-label="Abrir menu da conta"
                  aria-haspopup="menu"
                  sx={{ ml: 0.5 }}
                >
                  <Avatar sx={{ width: 34, height: 34, fontSize: '0.875rem' }}>
                    {user.nome?.charAt(0)?.toUpperCase() || '?'}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Box sx={{ px: 2, py: 1.25, minWidth: 210 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                      {user.nome}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" noWrap sx={{ display: 'block' }}>
                      {user.email}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <MenuItem
                    onClick={() => {
                      navigate(getDashboardPath());
                      setAnchorEl(null);
                    }}
                  >
                    <Dashboard fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                    Meu painel
                  </MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                    <Logout fontSize="small" sx={{ mr: 1.5 }} />
                    Sair
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  component={RouterLink}
                  to="/login"
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, ml: 0.5, color: 'text.primary' }}
                >
                  Entrar
                </Button>
                <Button
                  component={RouterLink}
                  to="/cadastro"
                  variant="contained"
                  startIcon={<PersonAdd />}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  Criar conta
                </Button>
              </>
            )}

            <IconButton
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu de navegação"
              sx={{ display: { md: 'none' }, ml: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Drawer mobile */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: 300 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, height: layoutTokens.appBar }}>
          <Logo size={32} onClick={() => setMobileOpen(false)} />
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <Close />
          </IconButton>
        </Box>
        <Divider />
        <List sx={{ px: 1.5, py: 1.5 }}>
          {navLinks.map((link) => (
            <ListItem key={link.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                selected={isActive(link.path)}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{link.icon}</ListItemIcon>
                <ListItemText primary={link.label} slotProps={{ primary: { sx: { fontSize: '0.9375rem', fontWeight: 500 } } }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, mt: 'auto' }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={themeMode === 'dark' ? <LightMode /> : <DarkMode />}
            onClick={toggleTheme}
          >
            {themeMode === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </Button>
          {isAuthenticated && user ? (
            <>
              <Button fullWidth variant="contained" startIcon={<Dashboard />} component={RouterLink} to={getDashboardPath()} onClick={() => setMobileOpen(false)}>
                Meu painel
              </Button>
              <Button fullWidth color="inherit" startIcon={<Logout />} onClick={() => { setMobileOpen(false); handleLogout(); }}>
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth variant="contained" startIcon={<Login />} component={RouterLink} to="/login" onClick={() => setMobileOpen(false)}>
                Entrar
              </Button>
              <Button fullWidth variant="outlined" startIcon={<PersonAdd />} component={RouterLink} to="/cadastro" onClick={() => setMobileOpen(false)}>
                Criar conta
              </Button>
            </>
          )}
        </Box>
      </Drawer>

      {/* Conteúdo */}
      <Box component="main" id="conteudo-principal" sx={{ pt: `${layoutTokens.appBar}px`, flex: 1 }}>
        <Outlet />
      </Box>

      {/* Rodapé */}
      <Box
        component="footer"
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.paper : darkSurface.bg),
          color: (t) => (t.palette.mode === 'dark' ? 'text.primary' : darkSurface.text),
          mt: 'auto',
        }}
      >
        <Container maxWidth={false} sx={{ maxWidth: layoutTokens.maxContent + 64, px: { xs: 2, sm: 3, md: 4 }, py: { xs: 4, md: 6 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr', md: '2fr 1fr 1fr 1fr' },
              gap: { xs: 4, md: 5 },
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Logo size={32} to="/" onDark={theme.palette.mode !== 'dark'} />
              </Box>
              <Typography
                variant="body2"
                sx={{ maxWidth: 320, color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textMuted) }}
              >
                Pousadas, hotéis e chalés nas cidades mais bonitas do Rio Grande do Norte.
              </Typography>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textSubtle) }}>
                Navegar
              </Typography>
              <List dense disablePadding sx={{ mt: 1 }}>
                {footerNav.map((item) => (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={RouterLink}
                      to={item.path}
                      disableGutters
                      sx={{
                        minHeight: 32,
                        color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                        '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                        paddingBlock: 0,
                      }}
                    >
                      <Typography variant="body2">{item.label}</Typography>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textSubtle) }}>
                Para anfitriões
              </Typography>
              <List dense disablePadding sx={{ mt: 1 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={RouterLink}
                    to="/cadastro"
                    disableGutters
                    sx={{
                      minHeight: 32,
                      color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                      '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                      paddingBlock: 0,
                    }}
                  >
                    <Typography variant="body2">Anuncie sua hospedagem</Typography>
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    to="/login"
                    disableGutters
                    sx={{
                      minHeight: 32,
                      color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                      '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                      paddingBlock: 0,
                    }}
                  >
                    <Typography variant="body2">Acessar painel</Typography>
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textSubtle) }}>
                Conta
              </Typography>
              <List dense disablePadding sx={{ mt: 1 }}>
                {isAuthenticated ? (
                  <ListItem disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={getDashboardPath()}
                      disableGutters
                      sx={{
                        minHeight: 32,
                        color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                        '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                        paddingBlock: 0,
                      }}
                    >
                      <Typography variant="body2">Meu painel</Typography>
                    </ListItemButton>
                  </ListItem>
                ) : (
                  <>
                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        component={RouterLink}
                        to="/login"
                        disableGutters
                        sx={{
                          minHeight: 32,
                          color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                          '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                          paddingBlock: 0,
                        }}
                      >
                        <Typography variant="body2">Entrar</Typography>
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        component={RouterLink}
                        to="/cadastro"
                        disableGutters
                        sx={{
                          minHeight: 32,
                          color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.text),
                          '&:hover': { bgcolor: 'transparent', color: (t) => (t.palette.mode === 'dark' ? 'primary.main' : 'common.white') },
                          paddingBlock: 0,
                        }}
                      >
                        <Typography variant="body2">Criar conta</Typography>
                      </ListItemButton>
                    </ListItem>
                  </>
                )}
              </List>
            </Box>
          </Box>

          <Divider sx={{ my: 4, borderColor: (t) => (t.palette.mode === 'dark' ? 'divider' : darkSurface.divider) }} />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textSubtle) }}>
              © {new Date().getFullYear()} HospedaRN. Todos os direitos reservados.
            </Typography>
            <Typography variant="caption" sx={{ color: (t) => (t.palette.mode === 'dark' ? 'textSecondary' : darkSurface.textSubtle) }}>
              Rio Grande do Norte · Brasil
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
