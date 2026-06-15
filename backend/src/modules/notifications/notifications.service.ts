import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface WhatsAppJobData {
  phone: string;
  template: string;
  variables: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('whatsapp') private whatsappQueue: Queue,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST'),
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('MAIL_USER'),
        pass: this.config.get('MAIL_PASS'),
      },
    });
  }

  private async addToQueue(template: string, data: EmailJobData) {
    try {
      await this.emailQueue.add(template, data);
    } catch (error) {
      this.logger.warn(`Fila indisponível, enviando e-mail diretamente para ${data.to}`);
      const html = this.renderFallbackTemplate(template, data.context);
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', '"HospedaRN" <noreply@hospedarn.com.br>'),
        to: data.to,
        subject: data.subject,
        html,
      });
    }
  }

  private renderFallbackTemplate(template: string, ctx: Record<string, any>): string {
    const lines = Object.entries(ctx).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('');
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">${lines}</div>
        <div style="padding: 15px; background: #0097A7; text-align: center;">
          <p style="color: white; margin: 0; font-size: 12px;">HospedaRN — Hospedagens no Rio Grande do Norte</p>
        </div>
      </div>
    `;
  }

  async sendReservationPendingForEstablishment(data: {
    email: string;
    estabelecimento: string;
    hospedeNome: string;
    codigoReserva: string;
    checkIn: string;
    checkOut: string;
    quarto: string;
    adultos: number;
    criancas: number;
    valorTotal: number;
  }) {
    await this.addToQueue('reserva-pending-establishment', {
      to: data.email,
      subject: `Nova reserva pendente — ${data.estabelecimento}`,
      template: 'reserva-pending-establishment',
      context: data,
    } as EmailJobData);
  }

  async sendReservationCreated(data: {
    email: string;
    nome: string;
    codigoReserva: string;
    estabelecimento: string;
    checkIn: string;
    checkOut: string;
    valorTotal: number;
  }) {
    await this.addToQueue('reserva-created', {
      to: data.email,
      subject: `Reserva ${data.codigoReserva} criada com sucesso!`,
      template: 'reserva-created',
      context: data,
    } as EmailJobData);
  }

  async sendReservationConfirmed(data: {
    email: string;
    nome: string;
    codigoReserva: string;
    estabelecimento: string;
    checkIn: string;
    checkOut: string;
    valorTotal: number;
    pixKey: string;
    pixType: string;
  }) {
    await this.addToQueue('reserva-confirmed', {
      to: data.email,
      subject: `Sua reserva ${data.codigoReserva} foi confirmada!`,
      template: 'reserva-confirmed',
      context: data,
    } as EmailJobData);
  }

  async sendReservationCancelled(data: {
    email: string;
    nome: string;
    codigoReserva: string;
    estabelecimento: string;
    motivo?: string;
  }) {
    await this.addToQueue('reserva-cancelled', {
      to: data.email,
      subject: `Reserva ${data.codigoReserva} cancelada`,
      template: 'reserva-cancelled',
      context: data,
    } as EmailJobData);
  }

  async sendPaymentUploaded(data: {
    email: string;
    nome: string;
    codigoReserva: string;
    estabelecimento: string;
  }) {
    await this.addToQueue('pagamento-uploaded', {
      to: data.email,
      subject: `Comprovante recebido — Reserva ${data.codigoReserva}`,
      template: 'pagamento-uploaded',
      context: data,
    } as EmailJobData);
  }

  async sendPaymentConfirmed(data: {
    email: string;
    nome: string;
    codigoReserva: string;
    estabelecimento: string;
    checkIn: string;
    checkOut: string;
  }) {
    await this.addToQueue('pagamento-confirmed', {
      to: data.email,
      subject: `Pagamento aprovado — Reserva ${data.codigoReserva}`,
      template: 'pagamento-confirmed',
      context: data,
    } as EmailJobData);
  }

  async sendForgotPassword(data: {
    email: string;
    nome: string;
    token: string;
    resetUrl: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0097A7, #00BCD4); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏖️ HospedaRN</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Recuperação de Senha</h2>
          <p>Olá, <strong>${data.nome}</strong>!</p>
          <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background: #0097A7; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Redefinir Senha
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">Se você não solicitou esta recuperação, ignore este e-mail.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', '"HospedaRN" <noreply@hospedarn.com.br>'),
        to: data.email,
        subject: 'Recuperação de senha — HospedaRN',
        html,
      });
      this.logger.log(`E-mail de recuperação enviado (síncrono) para ${data.email}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail para ${data.email}:`, error);
      throw error;
    }
  }

}
