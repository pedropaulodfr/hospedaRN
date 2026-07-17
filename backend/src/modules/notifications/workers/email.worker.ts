import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.get('MAIL_HOST'),
      port: config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: config.get('MAIL_USER'),
        pass: config.get('MAIL_PASS'),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  async process(job: Job) {
    const { to, subject, template, context } = job.data;

    try {
      const html = this.renderTemplate(template, context);

      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', '"HospedaRN" <noreply@hospedarn.com.br>'),
        to,
        subject,
        html,
      });

      this.logger.log(`Email enviado para ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${to}:`, error);
      throw error;
    }
  }

  private renderTemplate(template: string, context: Record<string, any>): string {
    const templates: Record<string, (ctx: any) => string> = {
      'reserva-pending-establishment': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>📋 Nova Reserva Pendente</h2>
            <p>Olá! O estabelecimento <strong>${ctx.estabelecimento}</strong> recebeu uma nova solicitação de reserva.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #FF9800;">
              <p><strong>Hóspede:</strong> ${ctx.hospedeNome}</p>
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Quarto:</strong> ${ctx.quarto}</p>
              <p><strong>Check-in:</strong> ${ctx.checkIn}</p>
              <p><strong>Check-out:</strong> ${ctx.checkOut}</p>
              <p><strong>Adultos:</strong> ${ctx.adultos}</p>
              <p><strong>Crianças:</strong> ${ctx.criancas}</p>
              <p><strong>Valor Total:</strong> R$ ${ctx.valorTotal?.toFixed(2)}</p>
            </div>
            <p style="margin-top: 20px;">Acesse o painel do estabelecimento para analisar e responder esta solicitação.</p>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'reserva-created': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Olá, ${ctx.nome}!</h2>
            <p>Sua reserva foi criada com sucesso!</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #0097A7;">
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Estabelecimento:</strong> ${ctx.estabelecimento}</p>
              <p><strong>Check-in:</strong> ${ctx.checkIn}</p>
              <p><strong>Check-out:</strong> ${ctx.checkOut}</p>
              <p><strong>Valor Total:</strong> R$ ${ctx.valorTotal?.toFixed(2)}</p>
            </div>
            <p style="margin-top: 20px;">Aguarde a confirmação do estabelecimento.</p>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'reserva-confirmed': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>✅ Reserva Aprovada!</h2>
            <p>Olá, <strong>${ctx.nome}</strong>! Sua reserva foi aprovada pelo estabelecimento.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Estabelecimento:</strong> ${ctx.estabelecimento}</p>
              <p><strong>Check-in:</strong> ${ctx.checkIn}</p>
              <p><strong>Check-out:</strong> ${ctx.checkOut}</p>
              <p><strong>Valor Total:</strong> R$ ${ctx.valorTotal?.toFixed(2)}</p>
            </div>
            <div style="background: #FFF3E0; padding: 20px; border-radius: 8px; border-left: 4px solid #FF9800; margin-top: 20px;">
              <h3 style="margin: 0 0 10px 0;">💳 Pagamento</h3>
              <p>Sua reserva está <strong>aguardando pagamento</strong>. Para confirmá-la, realize o pagamento via PIX:</p>
              <p><strong>Chave PIX:</strong> ${ctx.pixKey}</p>
              <p><strong>Tipo:</strong> ${ctx.pixType}</p>
              <p style="margin-bottom: 0;">Após efetuar o pagamento, anexe o comprovante no sistema para que o estabelecimento possa confirmá-lo.</p>
            </div>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'reserva-cancelled': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>❌ Reserva Recusada</h2>
            <p>Olá, <strong>${ctx.nome}</strong>! Infelizmente sua reserva foi recusada.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #F44336;">
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Estabelecimento:</strong> ${ctx.estabelecimento}</p>
              ${ctx.motivo ? `<p><strong>Motivo:</strong> ${ctx.motivo}</p>` : ''}
            </div>
            <p style="margin-top: 20px;">Caso tenha dúvidas, entre em contato diretamente com o estabelecimento.</p>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'pagamento-uploaded': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>📄 Comprovante Recebido</h2>
            <p>Olá, <strong>${ctx.nome}</strong>!</p>
            <p>Seu comprovante de pagamento da reserva <strong>${ctx.codigoReserva}</strong> no estabelecimento <strong>${ctx.estabelecimento}</strong> foi enviado com sucesso.</p>
            <p>As informações de pagamento foram encaminhadas para análise do estabelecimento. Você será notificado assim que a confirmação for realizada.</p>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'pagamento-confirmed': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>🎉 Pagamento Aprovado!</h2>
            <p>Olá, <strong>${ctx.nome}</strong>! O pagamento da sua reserva foi aprovado pelo estabelecimento.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Estabelecimento:</strong> ${ctx.estabelecimento}</p>
              <p><strong>Check-in:</strong> ${ctx.checkIn}</p>
              <p><strong>Check-out:</strong> ${ctx.checkOut}</p>
            </div>
            <p style="margin-top: 20px;">Sua reserva está confirmada! Agora é só comparecer ao local na data e horários agendados para se hospedar. 🎊</p>
          </div>
          <div style="padding: 15px; background: #0097A7; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
          </div>
        </div>
      `,
      'forgot-password': (ctx) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Recuperação de Senha</h2>
            <p>Olá, <strong>${ctx.nome}</strong>!</p>
            <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${ctx.resetUrl}" style="background: #0097A7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Redefinir Senha
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">Se você não solicitou esta recuperação, ignore este e-mail.</p>
          </div>
        </div>
      `,

    };

    const templateFn = templates[template];
    return templateFn ? templateFn(context) : `<p>${JSON.stringify(context)}</p>`;
  }
}
