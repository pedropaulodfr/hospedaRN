/**
 * Tipos compartilhados das telas de estabelecimento que consultam
 * temporadas e preços (somente leitura).
 */

export interface Season {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  percentualAjuste: string | number;
}

export interface RoomPrice {
  quartoId: string;
  temporadaId: string;
  valor: number | string;
  temporada?: Season;
}

export interface RoomWithPrices {
  id: string;
  nome: string;
  capacidade: number;
  precoBase: number | string;
  ativo: boolean;
  precos?: RoomPrice[];
}
