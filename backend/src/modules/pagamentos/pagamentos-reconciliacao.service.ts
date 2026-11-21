import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './pagamentos.service';

const INTERVALO_PADRAO_SEGUNDOS = 300; // 5 min
const ATRASO_INICIAL_MS = 30_000; // deixa o app terminar de subir

/**
 * Dispara periodicamente a reconciliação dos pagamentos Mercado Pago pendentes.
 *
 * Por que existe: o webhook só funciona com URL pública + secret configurado.
 * Sem isso, o reconhecimento dependia de o hóspede manter a tela aberta (o
 * polling da página chama `/sincronizar`). Esta rotina desacopla a confirmação
 * de qualquer sessão de usuário.
 *
 * Configuração (opcional, via env):
 * - `MERCADO_PAGO_RECONCILIACAO_INTERVALO_SEGUNDOS` (default 300; `0` desliga)
 * - `MERCADO_PAGO_RECONCILIACAO_JANELA_HORAS` (default 72; idade máxima da cobrança)
 * - `MERCADO_PAGO_RECONCILIACAO_LOTE` (default 25; cobranças por ciclo)
 */
@Injectable()
export class PagamentosReconciliacaoService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PagamentosReconciliacaoService.name);
  private intervalo?: NodeJS.Timeout;
  private primeiraExecucao?: NodeJS.Timeout;
  private executando = false;
  private avisouSemCredencial = false;

  constructor(
    private readonly config: ConfigService,
    private readonly pagamentos: PaymentsService,
  ) {}

  onModuleInit() {
    const intervaloSegundos = this.lerNumero(
      'MERCADO_PAGO_RECONCILIACAO_INTERVALO_SEGUNDOS',
      INTERVALO_PADRAO_SEGUNDOS,
    );

    if (intervaloSegundos <= 0) {
      this.logger.log(
        'Reconciliação Mercado Pago desligada (MERCADO_PAGO_RECONCILIACAO_INTERVALO_SEGUNDOS=0)',
      );
      return;
    }

    this.logger.log(
      `Reconciliação Mercado Pago ativa: primeira execução em ${
        ATRASO_INICIAL_MS / 1000
      }s, depois a cada ${intervaloSegundos}s`,
    );

    this.primeiraExecucao = setTimeout(() => {
      void this.executarCiclo();
    }, ATRASO_INICIAL_MS);
    this.primeiraExecucao.unref?.();

    this.intervalo = setInterval(() => {
      void this.executarCiclo();
    }, intervaloSegundos * 1000);
    this.intervalo.unref?.();
  }

  onModuleDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
    if (this.primeiraExecucao) clearTimeout(this.primeiraExecucao);
  }

  /**
   * Executa um ciclo agora. Usado pelo agendador e pelo endpoint administrativo
   * `POST /pagamentos/reconciliar`.
   */
  async executarCiclo(
    opcoes: { lote?: number; janelaHoras?: number } = {},
  ) {
    if (this.executando) {
      return { habilitado: true as const, ignorado: 'ciclo-anterior-em-andamento' };
    }

    this.executando = true;
    try {
      const resumo = await this.pagamentos.reconciliarMercadoPagoPendentes({
        lote: this.lerNumero(
          'MERCADO_PAGO_RECONCILIACAO_LOTE',
          opcoes.lote ?? 25,
        ),
        janelaHoras: this.lerNumero(
          'MERCADO_PAGO_RECONCILIACAO_JANELA_HORAS',
          opcoes.janelaHoras ?? 72,
        ),
      });

      if (!resumo.habilitado && !this.avisouSemCredencial) {
        this.avisouSemCredencial = true;
        this.logger.warn(
          'Reconciliação Mercado Pago sem efeito: MERCADO_PAGO_ACCESS_TOKEN não configurado',
        );
      }

      return resumo;
    } catch (error) {
      // A rotina nunca pode derrubar o processo.
      this.logger.error(`Ciclo de reconciliação falhou: ${String(error)}`);
      return { habilitado: true as const, erro: String(error) };
    } finally {
      this.executando = false;
    }
  }

  private lerNumero(chave: string, padrao: number): number {
    const bruto = this.config.get<string>(chave);
    if (bruto === undefined || bruto === null || bruto === '') return padrao;
    const valor = Number(bruto);
    return Number.isFinite(valor) ? valor : padrao;
  }
}
