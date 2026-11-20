import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

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

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('whatsapp') private whatsappQueue: Queue,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  private async addToQueue(template: string, data: EmailJobData) {
    const payload = {
      to: data.to,
      subject: data.subject,
      template,
      context: data.context,
    };

    // Notificação é efeito colateral: nenhuma falha de e-mail pode derrubar o
    // fluxo de negócio (reserva, pagamento). Em serverless o envio é direto,
    // porque não existe worker consumindo a fila.
    if (this.mailService.providerName !== 'resend') {
      try {
        await this.mailService.send(payload);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar e-mail (${template}) para ${data.to}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return;
    }

    try {
      await this.emailQueue.add(template, data);
    } catch {
      try {
        this.logger.warn(`Fila indisponível, enviando e-mail diretamente para ${data.to}`);
        await this.mailService.send(payload);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar e-mail (${template}) para ${data.to}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
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
    await this.addToQueue('forgot-password', {
      to: data.email,
      subject: 'Recuperação de senha — HospedaRN',
      template: 'forgot-password',
      context: data,
    } as EmailJobData);
  }

}
