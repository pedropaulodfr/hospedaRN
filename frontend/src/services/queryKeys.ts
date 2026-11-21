import type { QueryClient } from '@tanstack/react-query';

/**
 * Chaves de query compartilhadas entre telas.
 *
 * Centralizar aqui evita o bug de invalidação silenciosa: se a chave usada no
 * `useQuery` divergir da chave usada no `invalidateQueries`, o cache nunca é
 * atualizado e a tela só muda com F5.
 */

/** Lista completa de reservas do hóspede (Minhas Reservas). */
export const GUEST_RESERVATIONS_KEY = ['guest-reservations-all'] as const;

/**
 * Marca a lista de reservas do hóspede como desatualizada e refaz a busca se a
 * tela estiver montada (fora dela, a próxima montagem já busca dados novos).
 *
 * Use após qualquer mutação que altere reservas: criar, cancelar, pagar,
 * confirmar ou enviar comprovante.
 */
export function invalidateGuestReservations(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: GUEST_RESERVATIONS_KEY });
}
