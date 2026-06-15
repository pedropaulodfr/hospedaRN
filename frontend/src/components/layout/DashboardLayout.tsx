import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, Avatar, IconButton, Divider, Chip,
  useTheme, useMediaQuery, Tooltip, Badge,
} from '@mui/material';
import {
  Dashboard, Hotel, CalendarMonth, Photo, AttachMoney, Assessment,
  Favorite, Person, Map, EmojiEvents, LocationCity, Settings, Description,
  Logout, ChevronLeft, BeachAccess, Notifications, Menu as MenuIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 260;

type MenuItemConfig = { label: string; path: string; icon: React.ReactNode; permission?: string };

const menuConfig: Record<'guest' | 'establishment' | 'admin', MenuItemConfig[]> = {
  guest: [
    { label: 'Dashboard', path: '/hospede', icon: <Dashboard /> },
    { label: 'Minhas Reservas', path: '/hospede/reservas', icon: <CalendarMonth /> },
    { label: 'Favoritos', path: '/hospede/favoritos', icon: <Favorite /> },
    { label: 'Meu Perfil', path: '/hospede/perfil', icon: <Person /> },
  ],
  establishment: [
    { label: 'Dashboard', path: '/estabelecimento', icon: <Dashboard />, permission: 'EST_DASHBOARD' },
    { label: 'Reservas', path: '/estabelecimento/reservas', icon: <CalendarMonth />, permission: 'EST_RESERVATIONS' },
    { label: 'Quartos', path: '/estabelecimento/quartos', icon: <Hotel />, permission: 'EST_ROOMS' },
    { label: 'Fotos', path: '/estabelecimento/fotos', icon: <Photo />, permission: 'EST_PHOTOS' },
    { label: 'Preços', path: '/estabelecimento/precos', icon: <AttachMoney />, permission: 'EST_PRICES' },
    { label: 'Relatórios', path: '/estabelecimento/relatorios', icon: <Assessment />, permission: 'EST_REPORTS' },
    { label: 'Equipe', path: '/estabelecimento/usuarios', icon: <Person />, permission: 'EST_USERS' },
    { label: 'Regras', path: '/estabelecimento/regras', icon: <Description /> },
    { label: 'Meu Perfil', path: '/estabelecimento/perfil', icon: <Settings /> },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin', icon: <Dashboard />, permission: 'ADMIN_DASHBOARD' },
    { label: 'Cidades', path: '/admin/cidades', icon: <LocationCity />, permission: 'ADMIN_CITIES' },
    { label: 'Estabelecimentos', path: '/admin/estabelecimentos', icon: <Hotel />, permission: 'ADMIN_ESTABLISHMENTS' },
    { label: 'Eventos', path: '/admin/eventos', icon: <EmojiEvents />, permission: 'ADMIN_EVENTS' },
    { label: 'Relatórios', path: '/admin/relatorios', icon: <Assessment />, permission: 'ADMIN_REPORTS' },
    { label: 'Usuários', path: '/admin/usuarios', icon: <Person />, permission: 'ADMIN_USERS' },
    { label: 'Meu Perfil', path: '/admin/perfil', icon: <Settings /> },
  ],
};

const roleLabel = {
  guest: { label: 'Hóspede', color: '#0097A7' },
  establishment: { label: 'Estabelecimento', color: '#FF7043' },
  admin: { label: 'Administrador', color: '#7C3AED' },
};

interface DashboardLayoutProps {
  userType: 'guest' | 'establishment' | 'admin';
}

export default function DashboardLayout({ userType }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const menu = menuConfig[userType];
  const roleInfo = roleLabel[userType];
  const drawerWidth = collapsed ? 72 : DRAWER_WIDTH;

  const handleLogout = () => {
    logout();
    toast.success('Até logo! 👋');
    navigate('/');
  };

  const DrawerContent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ p: collapsed ? 1 : 2.5, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 70 }}>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: '12px',
            background: 'linear-gradient(135deg, #0097A7, #FF7043)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BeachAccess sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        {!collapsed && (
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Outfit", sans-serif', fontWeight: 800,
              background: 'linear-gradient(135deg, #0097A7, #FF7043)',
              backgroundClip: 'text', WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            HospedaRN
          </Typography>
        )}
        {!isMobile && !collapsed && (
          <IconButton
            size="small" onClick={() => setCollapsed(true)}
            sx={{ ml: 'auto', color: 'text.secondary' }}
          >
            <ChevronLeft />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* User info */}
      {!collapsed && (
        <Box sx={{ px: 2, py: 2, bgcolor: 'rgba(0,151,167,0.04)', mx: 1.5, borderRadius: 2, my: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0097A7, #00BCD4)', fontSize: '0.875rem', fontWeight: 700 }}
            >
              {user?.nome.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, maxWidth: 140 }}>{user?.nome}</Typography>
              <Chip label={roleInfo.label} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${roleInfo.color}18`, color: roleInfo.color, fontWeight: 600 }} />
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ flex: 1, px: collapsed ? 0.5 : 1.5, py: 0.5 }}>
        {menu.filter((item) => {
          if (!item.permission) return true;
          if (user?.permissoes && user.permissoes.length > 0) {
            return user.permissoes.includes(item.permission);
          }
          return true; // Se o usuário não tem restrições de permissão (usuário principal), libera tudo
        }).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.label : ''} placement="right">
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={() => isMobile && setMobileOpen(false)}
                  sx={{
                    borderRadius: 2, minHeight: 44, px: collapsed ? 1.5 : 2,
                    bgcolor: isActive ? 'primary.main' : 'transparent',
                    color: isActive ? 'white' : 'text.secondary',
                    '&:hover': {
                      bgcolor: isActive ? 'primary.dark' : 'rgba(0,151,167,0.08)',
                      color: isActive ? 'white' : 'primary.main',
                    },
                    transition: 'all 0.2s ease',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit', mr: collapsed ? 0 : 0 }}>
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && <ListItemText primary={<Typography sx={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 500 }}>{item.label}</Typography>} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ mx: 1.5 }} />

      {/* Footer actions */}
      <Box sx={{ p: 1.5 }}>
        <Tooltip title={collapsed ? 'Sair' : ''} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{ borderRadius: 2, color: 'error.main', px: collapsed ? 1.5 : 2, justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit' }}>
              <Logout />
            </ListItemIcon>
            {!collapsed && <ListItemText primary={<Typography sx={{ fontWeight: 500 }}>Sair</Typography>} />}
          </ListItemButton>
        </Tooltip>
        {!collapsed && (
          <Box sx={{ mt: 1, p: 1 }}>
            <Chip
              label="Ver site público"
              size="small"
              component={Link}
              to="/"
              clickable
              sx={{ width: '100%', bgcolor: 'rgba(0,151,167,0.06)', color: 'primary.main', fontWeight: 500 }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth, flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth, boxSizing: 'border-box',
              transition: 'width 0.3s ease',
              overflow: 'hidden',
            },
          }}
        >
          <DrawerContent />
          {collapsed && (
            <IconButton
              onClick={() => setCollapsed(false)}
              size="small"
              sx={{ position: 'absolute', top: 20, right: -12, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', zIndex: 1 }}
            >
              <ChevronLeft sx={{ transform: 'rotate(180deg)', fontSize: 16 }} />
            </IconButton>
          )}
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <DrawerContent />
        </Drawer>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top AppBar for mobile */}
        {isMobile && (
          <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar>
              <IconButton onClick={() => setMobileOpen(true)} edge="start">
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 700 }}>HospedaRN</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton><Notifications /></IconButton>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem', ml: 1 }}>
                {user?.nome.charAt(0).toUpperCase()}
              </Avatar>
            </Toolbar>
          </AppBar>
        )}

        {/* Page Content */}
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
