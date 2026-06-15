import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';

// Public pages
import HomePage from './pages/public/HomePage';
import SearchPage from './pages/public/SearchPage';
import EstablishmentDetailPage from './pages/public/EstablishmentDetailPage';
import EventsPage from './pages/public/EventsPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';

// Guest pages
import GuestDashboard from './pages/guest/GuestDashboard';
import GuestReservations from './pages/guest/GuestReservations';
import GuestFavorites from './pages/guest/GuestFavorites';
import GuestProfile from './pages/guest/GuestProfile';

// Establishment pages
import EstDashboard from './pages/establishment/EstDashboard';
import EstReservations from './pages/establishment/EstReservations';
import EstRooms from './pages/establishment/EstRooms';
import EstPhotos from './pages/establishment/EstPhotos';
import EstPrices from './pages/establishment/EstPrices';
import EstReports from './pages/establishment/EstReports';
import EstProfile from './pages/establishment/EstProfile';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCities from './pages/admin/AdminCities';
import AdminEvents from './pages/admin/AdminEvents';
import AdminEstablishments from './pages/admin/AdminEstablishments';
import AdminReports from './pages/admin/AdminReports';
import AdminProfile from './pages/admin/AdminProfile';
import AdminUsers from './pages/admin/AdminUsers';
import EstUsers from './pages/establishment/EstUsers';
import EstRegras from './pages/establishment/EstRegras';

// Protected Route component
const ProtectedRoute = ({
  children,
  roles,
  permission,
}: {
  children: React.ReactNode;
  roles?: string[];
  permission?: string;
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (permission && user?.permissoes && user.permissoes.length > 0 && !user.permissoes.includes(permission)) {
    // Se o usuário tem restrições de permissões e não tem essa, redireciona.
    // Opcional: Se for um usuário principal, permissoes pode estar vazio/indefinido, então libera.
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/busca" element={<SearchPage />} />
          <Route path="/hospedagem/:id" element={<EstablishmentDetailPage />} />
          <Route path="/eventos" element={<EventsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/nova-senha" element={<ResetPasswordPage />} />
        </Route>

        {/* Guest Routes */}
        <Route
          path="/hospede"
          element={
            <ProtectedRoute roles={['GUEST']}>
              <DashboardLayout userType="guest" />
            </ProtectedRoute>
          }
        >
          <Route index element={<GuestDashboard />} />
          <Route path="reservas" element={<GuestReservations />} />
          <Route path="favoritos" element={<GuestFavorites />} />
          <Route path="perfil" element={<GuestProfile />} />
        </Route>

        {/* Establishment Routes */}
        <Route
          path="/estabelecimento"
          element={
            <ProtectedRoute roles={['ESTABLISHMENT']}>
              <DashboardLayout userType="establishment" />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProtectedRoute permission="EST_DASHBOARD"><EstDashboard /></ProtectedRoute>} />
          <Route path="reservas" element={<ProtectedRoute permission="EST_RESERVATIONS"><EstReservations /></ProtectedRoute>} />
          <Route path="quartos" element={<ProtectedRoute permission="EST_ROOMS"><EstRooms /></ProtectedRoute>} />
          <Route path="fotos" element={<ProtectedRoute permission="EST_PHOTOS"><EstPhotos /></ProtectedRoute>} />
          <Route path="precos" element={<ProtectedRoute permission="EST_PRICES"><EstPrices /></ProtectedRoute>} />
          <Route path="relatorios" element={<ProtectedRoute permission="EST_REPORTS"><EstReports /></ProtectedRoute>} />
          <Route path="perfil" element={<EstProfile />} />
          <Route path="usuarios" element={<ProtectedRoute permission="EST_USERS"><EstUsers /></ProtectedRoute>} />
          <Route path="regras" element={<EstRegras />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <DashboardLayout userType="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProtectedRoute permission="ADMIN_DASHBOARD"><AdminDashboard /></ProtectedRoute>} />
          <Route path="cidades" element={<ProtectedRoute permission="ADMIN_CITIES"><AdminCities /></ProtectedRoute>} />
          <Route path="estabelecimentos" element={<ProtectedRoute permission="ADMIN_ESTABLISHMENTS"><AdminEstablishments /></ProtectedRoute>} />
          <Route path="eventos" element={<ProtectedRoute permission="ADMIN_EVENTS"><AdminEvents /></ProtectedRoute>} />
          <Route path="relatorios" element={<ProtectedRoute permission="ADMIN_REPORTS"><AdminReports /></ProtectedRoute>} />
          <Route path="perfil" element={<AdminProfile />} />
          <Route path="usuarios" element={<ProtectedRoute permission="ADMIN_USERS"><AdminUsers /></ProtectedRoute>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
