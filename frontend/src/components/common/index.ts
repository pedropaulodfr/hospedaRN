/**
 * Design system do HospedaRN — componentes compartilhados.
 *
 * Regra: toda tela nova/refatorada usa estes componentes em vez de recriar
 * cabeçalho, card de seção, estado vazio, selo de status e barra de filtros.
 */
export { PageContainer, PageHeader, SectionHeading } from './PageShell';
export { SectionCard } from './SectionCard';
export { StatCard } from './StatCard';
export { StatusChip, StatusDot, ModoPagamentoChip } from './StatusChip';
export {
  EmptyState,
  ErrorState,
  PageLoading,
  InlineLoading,
  TableSkeleton,
  CardGridSkeleton,
  FormError,
  EmptySearchIcon,
} from './StateViews';
export { ConfirmDialog } from './ConfirmDialog';
export { FormSection, FormGrid, FormSpan, FormActions } from './FormLayout';
export { DataToolbar, DataToolbarGroup, SearchField } from './DataToolbar';
export { InfoGrid, InfoItem, InfoRow } from './InfoList';
export { Logo, LogoMark } from './Logo';
export { MediaFallback } from './MediaFallback';
export { toneColor, toneSurface, toneBorder } from './tone';
