import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

declare global {
  interface Window {
    __ENV__?: { VITE_API_URL?: string };
  }
}

const API_BASE_URL = window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Request interceptor — inject access token and handle FormData
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let the browser set Content-Type with boundary for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 and refresh token
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refreshToken, userId, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken || !userId) {
        logout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { 'x-usuario-id': userId } },
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// API service objects
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: any) => api.post('/auth/reset-password', data),
};

export const usersApi = {
  getMe: () => api.get('/usuarios/me'),
  updateMe: (data: any) => api.patch('/usuarios/me', data),
  changePassword: (data: any) => api.patch('/usuarios/me/password', data),
  getAll: (params?: any) => api.get('/usuarios', { params }),
};

export const subUsersApi = {
  getAll: () => api.get('/usuarios/sub-users/list'),
  create: (data: any) => api.post('/usuarios/sub-users', data),
  update: (id: string, data: any) => api.patch(`/usuarios/sub-users/${id}`, data),
  delete: (id: string) => api.delete(`/usuarios/sub-users/${id}`),
};

export const citiesApi = {
  getAll: (ativo?: boolean) => api.get('/cidades', { params: { ativo } }),
  getOne: (id: string) => api.get(`/cidades/${id}`),
  getNearby: (lat: number, lng: number, radius?: number) => api.get('/cidades/nearby', { params: { lat, lng, radius } }),
  create: (data: any) => api.post('/cidades', data),
  update: (id: string, data: any) => api.patch(`/cidades/${id}`, data),
  delete: (id: string) => api.delete(`/cidades/${id}`),
};

export const establishmentsApi = {
  getAll: (params?: any) => api.get('/estabelecimentos', { params }),
  getOne: (id: string) => api.get(`/estabelecimentos/${id}`),
  getNearby: (lat: number, lng: number, radius?: number) => api.get('/estabelecimentos/nearby', { params: { lat, lng, radius } }),
  getMy: () => api.get('/estabelecimentos/proprietario/my'),
  create: (data: any) => api.post('/estabelecimentos', data),
  update: (id: string, data: any) => api.patch(`/estabelecimentos/${id}`, data),
  toggleActive: (id: string) => api.patch(`/estabelecimentos/${id}/toggle-active`),
  delete: (id: string) => api.delete(`/estabelecimentos/${id}`),
};

export const roomsApi = {
  getByEstablishment: (id: string) => api.get(`/quartos/estabelecimento/${id}`),
  getSeasons: () => api.get('/quartos/temporadas'),
  getOne: (id: string) => api.get(`/quartos/${id}`),
  checkAvailability: (id: string, checkIn: string, checkOut: string) =>
    api.get(`/quartos/${id}/availability`, { params: { checkIn, checkOut } }),
  calculatePrice: (id: string, checkIn: string, checkOut: string) =>
    api.get(`/quartos/${id}/preco`, { params: { checkIn, checkOut } }),
  create: (data: any) => api.post('/quartos', data),
  update: (id: string, data: any) => api.patch(`/quartos/${id}`, data),
  setPrice: (id: string, data: any) => api.post(`/quartos/${id}/precos`, data),
  blockDate: (id: string, data: any) => api.post(`/quartos/${id}/block`, data),
  unblockDate: (id: string, date: string) => api.delete(`/quartos/${id}/block/${date}`),
  delete: (id: string) => api.delete(`/quartos/${id}`),
};

export const reservationsApi = {
  getAll: (params?: any) => api.get('/reservas', { params }),
  getOne: (id: string) => api.get(`/reservas/${id}`),
  getByCode: (code: string) => api.get(`/reservas/code/${code}`),
  create: (data: any) => api.post('/reservas', data),
  confirm: (id: string) => api.patch(`/reservas/${id}/confirm`),
  cancel: (id: string, data?: any) => api.patch(`/reservas/${id}/cancel`, data),
  finalize: (id: string) => api.patch(`/reservas/${id}/finalize`),
};

export const paymentsApi = {
  create: (data: any) => api.post('/pagamentos', data),
  getByReservation: (id: string) => api.get(`/pagamentos/reserva/${id}`),
  generatePix: (reservationId: string) => api.get(`/pagamentos/pix/${reservationId}`),
  confirm: (id: string) => api.post(`/pagamentos/${id}/confirm`),
  uploadComprovante: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/pagamentos/${id}/comprovante`, formData);
  },
};

export const eventsApi = {
  getAll: (upcoming?: boolean) => api.get('/eventos', { params: { upcoming } }),
  getByCity: (cityId: string) => api.get(`/eventos/cidade/${cityId}`),
  getOne: (id: string) => api.get(`/eventos/${id}`),
  create: (data: any) => api.post('/eventos', data),
  update: (id: string, data: any) => api.patch(`/eventos/${id}`, data),
  delete: (id: string) => api.delete(`/eventos/${id}`),
};

export const reviewsApi = {
  getByEstablishment: (id: string) => api.get(`/avaliacoes/estabelecimento/${id}`),
  create: (data: any) => api.post('/avaliacoes', data),
};

export const favoritesApi = {
  getAll: () => api.get('/favoritos'),
  toggle: (establishmentId: string) => api.post(`/favoritos/${establishmentId}`),
};

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  byCity: () => api.get('/reports/reservas/by-cidade'),
  byStatus: (estabelecimentoId?: string) => api.get('/reports/reservas/by-status', { params: { estabelecimentoId } }),
  occupancy: (establishmentId: string, month: number, year: number) =>
    api.get(`/reports/occupancy/${establishmentId}`, { params: { month, year } }),
  upcomingEvents: () => api.get('/reports/eventos/upcoming'),
  cancellations: () => api.get('/reports/cancellations'),
};

export const mapsApi = {
  getNearbyEstablishments: (lat: number, lng: number, radius?: number) =>
    api.get('/maps/establishments/nearby', { params: { lat, lng, radius } }),
  getCities: () => api.get('/maps/cities'),
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) =>
    api.get('/maps/distance', { params: { lat1, lng1, lat2, lng2 } }),
};

export const uploadsApi = {
  uploadImage: (folder: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/uploads/image/${folder}`, formData);
  },
  uploadFile: (folder: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/uploads/file/${folder}`, formData);
  },
};

export const amenitiesApi = {
  getAll: () => api.get('/comodidades'),
};

export const accommodationTypesApi = {
  getAll: () => api.get('/tipos-acomodacao'),
};

export const fotosApi = {
  findByEstablishment: (id: string) => api.get(`/fotos/estabelecimento/${id}`),
  findByRoom: (id: string) => api.get(`/fotos/quarto/${id}`),
  create: (data: any) => api.post('/fotos', data),
  update: (id: string, data: any) => api.patch(`/fotos/${id}`, data),
  delete: (id: string) => api.delete(`/fotos/${id}`),
};
