/**
 * Contrato local da funcionalidade de Check-out.
 *
 * Espelha o payload fixado pelo backend para `GET /checkouts`,
 * `GET /checkouts/:reservaId` e `POST /checkouts`. Enquanto o projeto não tem
 * `src/types`, os tipos vivem junto do domínio que os usa (padrão das páginas
 * e do contrato de check-in).
 */

/** Situação operacional do check-out. `HOSPEDADO` = hospedagem em andamento. */
export type SituacaoCheckout = 'HOSPEDADO' | 'SAIDA_HOJE' | 'ATRASADO' | 'REALIZADO';

/** Filtro `situacao` aceito por `GET /checkouts`. */
export type SituacaoFiltroCheckout =
  | 'TODOS'
  | 'EM_ANDAMENTO'
  | 'SAIDAS_HOJE'
  | 'ATRASADOS'
  | 'REALIZADOS';

export type CodigoAvisoCheckout =
  | 'PAGAMENTO_PENDENTE'
  | 'SAIDA_ANTECIPADA'
  | 'SAIDA_APOS_PREVISTO'
  | 'SALDO_EM_ABERTO';

export interface ResponsavelCheckout {
  id: string;
  nome: string;
}

/** Registro de check-in ou de check-out (mesma forma nos dois lados). */
export interface RegistroOperacao {
  id: string;
  realizadoEm: string;
  observacoes?: string | null;
  responsavel: ResponsavelCheckout | null;
}

export interface PagamentoResumo {
  id: string;
  metodo: string;
  status: string;
  valor: number | string;
}

export interface HospedeResumo {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
}

export interface HospedePerfil {
  cpf?: string | null;
  rg?: string | null;
  dataNascimento?: string | null;
  nacionalidade?: string | null;
  contatoEmergencia?: string | null;
  endereco?: string | null;
}

export interface QuartoResumo {
  id: string;
  nome: string;
  capacidade: number;
}

export interface ReservaResumo {
  id: string;
  codigoReserva: string;
  checkIn: string;
  checkOut: string;
  adultos: number;
  criancas: number;
  valorTotal: number | string;
  status: string;
  modoPagamento?: string | null;
  observacoes?: string | null;
  criadoEm?: string;
  hospede: HospedeResumo;
  quarto: QuartoResumo;
  pagamento: PagamentoResumo | null;
}

/** Reserva do detalhe: traz perfil do hóspede, tipo de acomodação e estabelecimento. */
export interface ReservaDetalhe extends ReservaResumo {
  hospede: HospedeResumo & { hospedePerfil?: HospedePerfil | null };
  quarto: QuartoResumo & { tipoAcomodacao?: { id: string; nome: string } | null };
  estabelecimento?: { id: string; nome: string } | null;
}

export interface CheckinHospede {
  id: string;
  principal: boolean;
  nome: string;
  cpf?: string | null;
  documento?: string | null;
  dataNascimento?: string | null;
  telefone?: string | null;
  parentesco?: string | null;
  presente: boolean;
  observacoes?: string | null;
}

export interface CheckinDetalhe {
  id: string;
  realizadoEm: string;
  observacoes?: string | null;
  responsavel: ResponsavelCheckout | null;
  hospedes: CheckinHospede[];
}

/** Item da listagem (`GET /checkouts`). */
export interface CheckoutListItem {
  reserva: ReservaResumo;
  checkin: RegistroOperacao | null;
  checkout: RegistroOperacao | null;
  situacaoCheckout: SituacaoCheckout;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  /** Código estável da inelegibilidade (ex.: `CHECKOUT_JA_REALIZADO`). */
  codigoInelegibilidade?: string | null;
  /** Negativo = saída prevista no futuro; 0 = hoje; positivo = atraso em dias. */
  diasAposSaidaPrevista: number;
  saidaAntecipada: boolean;
}

export interface ResumoCheckouts {
  emAndamento: number;
  saidasHoje: number;
  atrasados: number;
  realizadosHoje: number;
}

export interface CheckoutListPayload {
  data: CheckoutListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  resumo: ResumoCheckouts;
}

export interface AvisoCheckout {
  codigo: CodigoAvisoCheckout | string;
  mensagem: string;
}

/** Conferência financeira da hospedagem — informativa, não gera cobrança. */
export interface FinanceiroCheckout {
  valorTotal: number;
  valorPago: number;
  saldoEmAberto: number;
  pagamento: { metodo: string; status: string; valor: number } | null;
}

export interface AcomodacaoCheckout {
  id: string;
  nome: string;
  capacidade: number;
  tipoAcomodacao: { id: string; nome: string } | null;
  proximaEntrada: {
    reservaId: string;
    codigoReserva: string;
    checkIn: string;
    hospedeNome: string;
  } | null;
}

/** Payload de `GET /checkouts/:reservaId`. */
export interface CheckoutDetalhePayload {
  reserva: ReservaDetalhe;
  checkin: CheckinDetalhe | null;
  checkout: RegistroOperacao | null;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  /** Código estável da inelegibilidade (ex.: `CHECKOUT_JA_REALIZADO`). */
  codigoInelegibilidade?: string | null;
  avisos: AvisoCheckout[];
  financeiro: FinanceiroCheckout;
  acomodacao: AcomodacaoCheckout;
}

/** Corpo de `POST /checkouts`. `realizadoEm` só vai quando o operador informa. */
export interface CheckoutBody {
  reservaId: string;
  realizadoEm?: string;
  observacoes?: string;
}

/** Limite imposto pela UI (e validado pelo backend). */
export const MAX_OBSERVACOES = 1000;
