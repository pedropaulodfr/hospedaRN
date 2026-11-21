import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

/** Item devolvido por `GET /favoritos` (inclui o estabelecimento e a cidade). */
export interface FavoriteItem {
  id: string;
  estabelecimentoId: string;
  criadoEm: string;
  estabelecimento?: {
    id: string;
    nome: string;
    descricao?: string;
    endereco?: string;
    fotoPerfil?: string;
    notaMedia?: number | string;
    totalAvaliacoes?: number;
    cidade?: { id: string; nome: string; estado?: string };
  };
}

/** Chave única da lista de favoritos do usuário logado. */
export const FAVORITES_KEY = ['favorites'] as const;

/**
 * Favoritos do hóspede — fonte única para o coração dos cards e para a tela
 * "Favoritos".
 *
 * - `GET /favoritos` é uma lista simples; o estado de cada coração é derivado dela.
 * - `POST /favoritos/:id` é **toggle** no backend: a resposta diz o estado final.
 * - Após cada toggle a lista é invalidada, então todas as telas convergem.
 */
export function useFavorites() {
  const { isAuthenticated, user } = useAuthStore();
  const queryClient = useQueryClient();

  // Só hóspede favorita: estabelecimento é dono e admin não usa a lista pessoal.
  const canFavorite = isAuthenticated && user?.role === 'GUEST';

  const query = useQuery<FavoriteItem[]>({
    queryKey: FAVORITES_KEY,
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      return res.data?.data ?? res.data ?? [];
    },
    enabled: canFavorite,
    staleTime: 60_000,
  });

  const favoriteIds = useMemo(
    () => new Set((query.data ?? []).map((f) => f.estabelecimentoId)),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: (estabelecimentoId: string) => favoritesApi.toggle(estabelecimentoId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  const toggleFavorite = async (estabelecimentoId: string): Promise<boolean> => {
    const res = await mutation.mutateAsync(estabelecimentoId);
    const payload = res?.data?.data ?? res?.data;
    return Boolean(payload?.favorited);
  };

  return {
    canFavorite,
    isFavorite: (estabelecimentoId: string) => favoriteIds.has(estabelecimentoId),
    toggleFavorite,
    isToggling: mutation.isPending,
    isLoading: query.isLoading,
    favorites: (query.data ?? []) as FavoriteItem[],
  };
}
