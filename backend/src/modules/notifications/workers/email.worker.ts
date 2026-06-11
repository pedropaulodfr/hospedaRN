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
            <h2>✅ Reserva Confirmada!</h2>
            <p>Olá, <strong>${ctx.nome}</strong>! Sua reserva foi confirmada pelo estabelecimento.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50;">
              <p><strong>Código:</strong> ${ctx.codigoReserva}</p>
              <p><strong>Estabelecimento:</strong> ${ctx.estabelecimento}</p>
              <p><strong>Check-in:</strong> ${ctx.checkIn}</p>
              <p><strong>Check-out:</strong> ${ctx.checkOut}</p>
            </div>
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
