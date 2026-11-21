/**
 * Tokens de design do HospedaRN.
 *
 * Fonte única de verdade para raio, movimento, layout e semântica de status.
 * Regra do projeto: nenhum `#hex` solto em página — use `theme.palette.*`,
 * `statusMeta` (abaixo) ou `alpha()`.
 */

/** Escala de raio de borda (px). Consistente em cards, botões, campos e chips. */
export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

/** Durações e curva de animação. Feedback de pressão deve ficar entre 80–150ms. */
export const motion = {
  fast: '120ms',
  base: '180ms',
  slow: '260ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** Métricas de layout (px). */
export const layout = {
  maxContent: 1320,
  maxReading: 720,
  sidebar: 264,
  sidebarCollapsed: 76,
  appBar: 72,
} as const;

/** Altura mínima de alvo de toque (WCAG 2.5.5 / Material). */
export const touchTarget = 44;

/**
 * Gradiente da marca — valores originais do produto (não fazem parte da paleta
 * de interface). Usado somente na logo: símbolo e assinatura.
 */
export const brandGradient = 'linear-gradient(135deg, #0097A7 0%, #FF7043 100%)';

/** Gradiente da assinatura "HospedaRN" (mesmo par de cores da marca). */
export const brandTextGradient = 'linear-gradient(135deg, #0097A7 0%, #FF7043 100%)';

export type Tone =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

export interface StatusMeta {
  label: string;
  tone: Tone;
}

/**
 * Semântica de status do domínio de hospedagens.
 * Cor nunca é o único indicador: `StatusChip` sempre renderiza rótulo textual + ponto.
 */
export const statusMeta: Record<string, StatusMeta> = {
  // Ciclo de vida da reserva
  SOLICITADA: { label: 'Solicitada', tone: 'warning' },
  CONFIRMADA: { label: 'Confirmada', tone: 'success' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', tone: 'info' },
  FINALIZADA: { label: 'Finalizada', tone: 'neutral' },
  CANCELADA: { label: 'Cancelada', tone: 'error' },
  // Pagamento
  PENDENTE: { label: 'Pendente', tone: 'warning' },
  APROVADO: { label: 'Aprovado', tone: 'success' },
  RECUSADO: { label: 'Recusado', tone: 'error' },
  CANCELADO: { label: 'Cancelado', tone: 'error' },
  ESTORNADO: { label: 'Estornado', tone: 'neutral' },
  EM_ANALISE: { label: 'Em análise', tone: 'info' },
  PROCESSANDO: { label: 'Processando', tone: 'info' },
  // Situação do check-in (PENDENTE já existe em Pagamento e compartilha o tom)
  REALIZADO: { label: 'Realizado', tone: 'success' },
  ATRASADO: { label: 'Atrasado', tone: 'error' },
  // Situação do check-out (`HOSPEDADO` = hospedagem em andamento)
  HOSPEDADO: { label: 'Hospedado', tone: 'info' },
  SAIDA_HOJE: { label: 'Saída hoje', tone: 'warning' },
  // Genéricos de entidade
  ATIVO: { label: 'Ativo', tone: 'success' },
  INATIVO: { label: 'Inativo', tone: 'neutral' },
  BLOQUEADO: { label: 'Bloqueado', tone: 'error' },
};

/** Modos de pagamento do estabelecimento (snapshot na reserva). */
export const modoPagamentoMeta: Record<string, StatusMeta> = {
  PADRAO: { label: 'Pagamento direto', tone: 'neutral' },
  MERCADO_PAGO: { label: 'Mercado Pago', tone: 'info' },
};

/**
 * Larguras semânticas de container usadas nas páginas.
 * Evita a mistura de `p: 4` + `maxWidth: 1400` espalhada pelo código antigo.
 */
export const containerWidth = {
  narrow: 560,
  form: 720,
  reading: 860,
  content: layout.maxContent,
  wide: 1560,
} as const;

/**
 * Superfícies permanentemente escuras (rodapé público, faixas de marca).
 * Diferente do dark mode: estas cores não mudam com o tema — por isso vivem em
 * token, e não espalhadas como `#hex` nos componentes.
 */
export const darkSurface = {
  bg: '#0B1220',
  bgSoft: '#111C2E',
  text: '#E2E8F0',
  textMuted: 'rgba(226,232,240,0.68)',
  textSubtle: 'rgba(226,232,240,0.55)',
  divider: 'rgba(255,255,255,0.12)',
  accent: '#5EEAD4',
} as const;

/** Formata moeda em BRL de forma estável entre telas. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(n as number) ? (n as number) : 0);
}

/**
 * Data de calendário (`YYYY-MM-DD`) ou o mesmo valor serializado pelo Prisma
 * em `@db.Date` como meia-noite UTC (`YYYY-MM-DDT00:00:00.000Z`).
 * Esses valores NÃO têm hora: formatar no fuso local deslocaria um dia em UTC-3.
 */
const DATA_CALENDARIO = /^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/;

/** Formata data (ISO ou Date) em pt-BR. `undefined`/inválido → '—'. */
export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  if (!value) return '—';

  // Data pura (sem hora): é uma data de calendário, sem fuso. Monta em UTC e
  // formata em UTC — assim o dia exibido é sempre o mesmo, em qualquer fuso
  // (o `new Date('YYYY-MM-DD')` padrão cai em meia-noite UTC e recuava um dia).
  if (typeof value === 'string' && DATA_CALENDARIO.test(value)) {
    const [ano, mes, dia] = value.slice(0, 10).split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== ano ||
      d.getUTCMonth() !== mes - 1 ||
      d.getUTCDate() !== dia
    ) {
      return '—';
    }
    return new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone: 'UTC' }).format(d);
  }

  // Datetimes ISO (ex.: realizadoEm, criadoEm): continuam no fuso local.
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', opts).format(d);
}
