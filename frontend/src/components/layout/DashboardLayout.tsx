import { useState } from 'react';
import { Outlet, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  IconButton,
  Divider,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Dashboard,
  Hotel,
  CalendarMonth,
  Photo,
  AttachMoney,
  Assessment,
  Favorite,
  Person,
  EmojiEvents,
  LocationCity,
  Settings,
  Description,
  Logout,
  BeachAccess,
  Menu as MenuIcon,
  DarkMode,
  LightMode,
  ChevronLeft,
  ChevronRight,
  OpenInNew,
  HowToReg,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Logo, LogoMark } from '../common/Logo';
import { layout as layoutTokens } from '../../theme/tokens';
import toast from 'react-hot-toast';

type UserType = 'guest' | 'establishment' | 'admin';

type MenuItemConfig = {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  section: string;
};

const menuConfig: Record<UserType, MenuItemConfig[]> = {
  guest: [
    { label: 'Visão geral', path: '/hospede', icon: <Dashboard />, section: 'Principal' },
    { label: 'Minhas reservas', path: '/hospede/reservas', icon: <CalendarMonth />, section: 'Minha conta' },
    { label: 'Favoritos', path: '/hospede/favoritos', icon: <Favorite />, section: 'Minha conta' },
    { label: 'Meu perfil', path: '/hospede/perfil', icon: <Person />, section: 'Minha conta' },
  ],
  establishment: [
    { label: 'Visão geral', path: '/estabelecimento', icon: <Dashboard />, permission: 'EST_DASHBOARD', section: 'Principal' },
    { label: 'Reservas', path: '/estabelecimento/reservas', icon: <CalendarMonth />, permission: 'EST_RESERVATIONS', section: 'Operação' },
    { label: 'Check-in', path: '/estabelecimento/checkin', icon: <HowToReg />, permission: 'EST_RESERVATIONS', section: 'Operação' },
    { label: 'Check-out', path: '/estabelecimento/checkout', icon: <Logout />, permission: 'EST_RESERVATIONS', section: 'Operação' },
    { label: 'Quartos', path: '/estabelecimento/quartos', icon: <Hotel />, permission: 'EST_ROOMS', section: 'Operação' },
    { label: 'Fotos', path: '/estabelecimento/fotos', icon: <Photo />, permission: 'EST_PHOTOS', section: 'Operação' },
    { label: 'Preços e temporadas', path: '/estabelecimento/precos', icon: <AttachMoney />, permission: 'EST_PRICES', section: 'Operação' },
    { label: 'Relatórios', path: '/estabelecimento/relatorios', icon: <Assessment />, permission: 'EST_REPORTS', section: 'Gestão' },
    { label: 'Equipe', path: '/estabelecimento/usuarios', icon: <Person />, permission: 'EST_USERS', section: 'Gestão' },
    { label: 'Regras e políticas', path: '/estabelecimento/regras', icon: <Description />, section: 'Gestão' },
    { label: 'Perfil do estabelecimento', path: '/estabelecimento/perfil', icon: <Settings />, section: 'Conta' },
  ],
  admin: [
    { label: 'Visão geral', path: '/admin', icon: <Dashboard />, permission: 'ADMIN_DASHBOARD', section: 'Principal' },
    { label: 'Cidades', path: '/admin/cidades', icon: <LocationCity />, permission: 'ADMIN_CITIES', section: 'Catálogo' },
    { label: 'Estabelecimentos', path: '/admin/estabelecimentos', icon: <Hotel />, permission: 'ADMIN_ESTABLISHMENTS', section: 'Catálogo' },
    { label: 'Eventos', path: '/admin/eventos', icon: <EmojiEvents />, permission: 'ADMIN_EVENTS', section: 'Catálogo' },
    { label: 'Relatórios', path: '/admin/relatorios', icon: <Assessment />, permission: 'ADMIN_REPORTS', section: 'Gestão' },
    { label: 'Usuários', path: '/admin/usuarios', icon: <Person />, permission: 'ADMIN_USERS', section: 'Gestão' },
    { label: 'Meu perfil', path: '/admin/perfil', icon: <Settings />, section: 'Conta' },
  ],
};

const roleLabel: Record<UserType, { label: string; tone: 'primary' | 'secondary' | 'info' }> = {
  guest: { label: 'Hóspede', tone: 'primary' },
  establishment: { label: 'Estabelecimento', tone: 'secondary' },
  admin: { label: 'Administrador', tone: 'info' },
};

export default function DashboardLayout({ userType }: { userType: UserType }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { mode, toggleMode } = useThemeStore();

  const menu = menuConfig[userType];
  const role = roleLabel[userType];
  const drawerWidth = collapsed ? layoutTokens.sidebarCollapsed : layoutTokens.sidebar;

  const allowedMenu = menu.filter((item) => {
    if (!item.permission) return true;
    if (user?.permissoes && user.permissoes.length > 0) return user.permissoes.includes(item.permission);
    return true;
  });

  const currentItem =
    allowedMenu.find((item) => item.path === location.pathname) ??
    allowedMenu.find((item) => item.path !== '/' && location.pathname.startsWith(item.path));

  const sections = allowedMenu.reduce<Record<string, MenuItemConfig[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  const handleLogout = () => {
    logout();
    toast.success('Sessão encerrada.');
    navigate('/');
  };

  const toneMain = (color: 'primary' | 'secondary' | 'info') => theme.palette[color].main;

  const goTo = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const SidebarContent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Cabeçalho da sidebar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 1,
          minHeight: layoutTokens.appBar,
          px: collapsed ? 1 : 2.5,
          flexShrink: 0,
        }}
      >
        {collapsed ? <LogoMark size={32} /> : <Logo size={32} />}
        {!collapsed && !isMobile && (
          <Tooltip title="Recolher menu">
            <IconButton size="small" onClick={() => setCollapsed(true)} aria-label="Recolher menu lateral">
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider />

      {/* Navegação */}
      <Box
        component="nav"
        aria-label="Navegação do painel"
        sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: collapsed ? 1 : 1.5, py: 1.5 }}
      >
        {Object.entries(sections).map(([section, items]) => (
          <Box key={section} sx={{ mb: 1.5 }}>
            {!collapsed && (
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  px: 1.5,
                  mb: 0.75,
                  color: 'text.secondary',
                  fontSize: '0.6875rem',
                  lineHeight: 1.4,
                }}
              >
                {section}
              </Typography>
            )}
            <List disablePadding>
              {items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <ListItemButton
                    key={item.path}
                    onClick={() => goTo(item.path)}
                    selected={active}
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      mb: 0.25,
                      minHeight: 42,
                      px: collapsed ? 1.5 : 1.75,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                      fontWeight: active ? 600 : 500,
                      position: 'relative',
                      '&::before': active
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            bottom: 8,
                            width: 3,
                            borderRadius: '0 3px 3px 0',
                            bgcolor: 'primary.main',
                          }
                        : {},
                      '&:hover': {
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.14)
                          : alpha(theme.palette.primary.main, 0.06),
                        color: active ? 'primary.main' : 'text.primary',
                      },
                      '& .MuiListItemIcon-root': {
                        minWidth: collapsed ? 0 : 34,
                        color: 'inherit',
                        justifyContent: 'center',
                        '& svg': { fontSize: 20 },
                      },
                    }}
                  >
                    <Tooltip title={collapsed ? item.label : ''} placement="right" disableHoverListener={!collapsed}>
                      <ListItemIcon>{item.icon}</ListItemIcon>
                    </Tooltip>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        slotProps={{
                          primary: { sx: { fontSize: '0.875rem', fontWeight: 'inherit', lineHeight: 1.4 } },
                        }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Divider />

      {/* Conta + tema */}
      <Box sx={{ p: collapsed ? 1 : 1.5, flexShrink: 0 }}>
        {collapsed ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Alternar tema" placement="right">
              <IconButton onClick={toggleMode} aria-label="Alternar tema claro/escuro" size="small">
                {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Sair" placement="right">
              <IconButton onClick={handleLogout} aria-label="Sair da conta" size="small" sx={{ color: 'error.main' }}>
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1,
                borderRadius: 2.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar sx={{ width: 34, height: 34, fontSize: '0.8125rem' }}>
                {user?.nome?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {user?.nome}
                </Typography>
                <Typography variant="caption" color="textSecondary" noWrap sx={{ display: 'block' }}>
                  {role.label}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              <Tooltip title="Alternar tema">
                <IconButton onClick={toggleMode} size="small" aria-label="Alternar tema claro/escuro" sx={{ flex: 1 }}>
                  {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Ver site público">
                <IconButton size="small" aria-label="Abrir site público" onClick={() => navigate('/')} sx={{ flex: 1 }}>
                  <BeachAccess fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Sair">
                <IconButton onClick={handleLogout} size="small" aria-label="Sair da conta" sx={{ flex: 1, color: 'error.main' }}>
                  <Logout fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Sidebar fixa (desktop) */}
      {!isMobile && (
        <Box
          component="aside"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: `width 200ms cubic-bezier(0.2,0,0,1)`,
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          <Drawer
            variant="permanent"
            open
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                boxSizing: 'border-box',
                transition: `width 200ms cubic-bezier(0.2,0,0,1)`,
                overflow: 'hidden',
              },
            }}
          >
            <SidebarContent />
            {collapsed && (
              <Tooltip title="Expandir menu" placement="right">
                <IconButton
                  onClick={() => setCollapsed(false)}
                  size="small"
                  aria-label="Expandir menu lateral"
                  sx={{
                    position: 'absolute',
                    top: 22,
                    right: -13,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    zIndex: 2,
                    '&:hover': { bgcolor: 'background.paper', borderColor: 'primary.main' },
                  }}
                >
                  <ChevronRight fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Drawer>
        </Box>
      )}

      {/* Drawer mobile */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{ paper: { sx: { width: layoutTokens.sidebar } } }}
        >
          <SidebarContent />
        </Drawer>
      )}

      {/* Coluna principal */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
            zIndex: (t) => t.zIndex.appBar,
          }}
        >
          <Toolbar sx={{ height: 64, minHeight: '64px !important', gap: 1.5, px: { xs: 2, md: 3 } }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" sx={{ ml: -0.5 }}>
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ display: { xs: 'none', sm: 'inline' }, whiteSpace: 'nowrap' }}
              >
                {role.label}
              </Typography>
              <KeyboardArrowRight
                sx={{ fontSize: 16, color: 'text.disabled', display: { xs: 'none', sm: 'inline' } }}
              />
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, color: 'text.primary' }}>
                {currentItem?.label ?? 'Painel'}
              </Typography>
            </Box>

            <Tooltip title="Ver site público">
              <IconButton onClick={() => navigate('/')} aria-label="Abrir site público" size="small">
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={mode === 'dark' ? 'Tema claro' : 'Tema escuro'}>
              <IconButton onClick={toggleMode} aria-label="Alternar tema claro/escuro" size="small">
                {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>

            <IconButton
              onClick={(e) => setAccountAnchor(e.currentTarget)}
              aria-label="Abrir menu da conta"
              sx={{ p: 0.5 }}
            >
              <Avatar sx={{ width: 34, height: 34, fontSize: '0.8125rem' }}>
                {user?.nome?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={accountAnchor}
              open={Boolean(accountAnchor)}
              onClose={() => setAccountAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ px: 2, py: 1.25, minWidth: 200 }}>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                  {user?.nome}
                </Typography>
                <Typography variant="caption" color="textSecondary" noWrap sx={{ display: 'block' }}>
                  {user?.email}
                </Typography>
                <Chip
                  size="small"
                  label={role.label}
                  sx={(t) => ({
                    mt: 0.75,
                    height: 20,
                    fontSize: '0.6875rem',
                    bgcolor: alpha(toneMain(role.tone), 0.12),
                    color: toneMain(role.tone),
                  })}
                />
              </Box>
              <Divider sx={{ my: 0.5 }} />
              {allowedMenu
                .filter((item) => item.label.toLowerCase().includes('perfil'))
                .map((item) => (
                  <MenuItem
                    key={item.path}
                    onClick={() => {
                      setAccountAnchor(null);
                      goTo(item.path);
                    }}
                  >
                    <Settings fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                    Meu perfil
                  </MenuItem>
                ))}
              <MenuItem
                onClick={() => {
                  setAccountAnchor(null);
                  navigate('/');
                }}
              >
                <BeachAccess fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                Ver site público
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAccountAnchor(null);
                  handleLogout();
                }}
                sx={{ color: 'error.main' }}
              >
                <Logout fontSize="small" sx={{ mr: 1.5 }} />
                Sair
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Área de conteúdo */}
        <Box component="main" id="conteudo-principal" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
