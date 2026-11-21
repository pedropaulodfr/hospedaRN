/**
 * Contrato local da funcionalidade de Check-in.
 *
 * Espelha o payload fixado pelo backend para `GET /checkins` e
 * `GET /checkins/:reservaId`. Enquanto o projeto não tem `src/types`,
 * os tipos vivem junto do domínio que os usa (padrão das páginas).
 */

export type SituacaoCheckIn = 'PENDENTE' | 'ATRASADO' | 'REALIZADO';

export type CodigoAvisoCheckIn =
  | 'PAGAMENTO_PENDENTE'
  | 'CADASTRO_INCOMPLETO'
  | 'CAPACIDADE_EXCEDIDA'
  | 'CHECKIN_ANTECIPADO'
  | 'CHECKIN_ATRASADO';

export interface ResponsavelCheckIn {
  id: string;
  nome: string;
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
  responsavel: ResponsavelCheckIn | null;
  hospedes: CheckinHospede[];
}

export interface CheckinRealizadoResumo {
  id: string;
  realizadoEm: string;
  observacoes?: string | null;
  responsavel: ResponsavelCheckIn | null;
}

/** Item da listagem (`GET /checkins`). */
export interface CheckInListItem {
  reserva: ReservaResumo;
  checkin: CheckinRealizadoResumo | null;
  situacaoCheckIn: SituacaoCheckIn;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  /** Código estável da inelegibilidade (ex.: `CHECKIN_JA_REALIZADO`). */
  codigoInelegibilidade?: string | null;
  checkInAntecipado: boolean;
  diasParaChegada: number;
}

export interface ResumoCheckins {
  chegadasHoje: number;
  pendentes: number;
  atrasados: number;
  realizados: number;
}

export interface CheckinListPayload {
  data: CheckInListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  resumo: ResumoCheckins;
}

export interface AvisoCheckIn {
  codigo: CodigoAvisoCheckIn | string;
  mensagem: string;
}

/** Payload de `GET /checkins/:reservaId` (pré-check-in). */
export interface CheckinDetalhePayload {
  reserva: ReservaDetalhe;
  checkin: CheckinDetalhe | null;
  elegivel: boolean;
  motivoInelegibilidade: string | null;
  /** Código estável da inelegibilidade (ex.: `CHECKIN_JA_REALIZADO`). */
  codigoInelegibilidade?: string | null;
  avisos: AvisoCheckIn[];
}

/** Estado editável de um acompanhante no formulário. */
export interface AcompanhanteForm {
  nome: string;
  cpf: string;
  documento: string;
  dataNascimento: string;
  telefone: string;
  parentesco: string;
  presente: boolean;
  observacoes: string;
}

/** Estado editável dos dados do hóspede principal (complemento de cadastro). */
export interface HospedePrincipalForm {
  cpf: string;
  /**
   * RG ou documento alternativo. No POST vai em dois lugares: `hospedePrincipal.documento`
   * (registro do check-in, `HospedeCheckIn`) e `hospedePrincipal.rg` (cadastro, `Hospede.rg`).
   */
  documento: string;
  dataNascimento: string;
  nacionalidade: string;
  telefone: string;
}

export const acompanhanteVazio = (): AcompanhanteForm => ({
  nome: '',
  cpf: '',
  documento: '',
  dataNascimento: '',
  telefone: '',
  parentesco: '',
  presente: true,
  observacoes: '',
});

/** Limite imposto pela UI (e validado pelo backend). */
export const MAX_ACOMPANHANTES = 20;
export const MAX_OBSERVACOES = 1000;
