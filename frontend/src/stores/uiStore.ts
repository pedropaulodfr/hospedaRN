import { create } from 'zustand';

interface SearchFilters {
  cityId?: string;
  search?: string;
  checkIn?: string;
  checkOut?: string;
  adultos?: number;
  criancas?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  amenityIds?: string;
  accommodationTypeIds?: string;
}

interface UIState {
  sidebarOpen: boolean;
  searchFilters: SearchFilters;
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  clearSearchFilters: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  searchFilters: {},

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearchFilters: (filters) =>
    set((state) => ({ searchFilters: { ...state.searchFilters, ...filters } })),
  clearSearchFilters: () => set({ searchFilters: {} }),
}));
