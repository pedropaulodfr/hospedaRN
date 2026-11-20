import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { renderMailTemplate } from './mail.templates';

export interface MailMessage {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

/**
 * Envio de e-mail com provedor selecionável por env.
 *
 * - MAIL_PROVIDER=resend      → API HTTP do Resend (exige domínio verificado)
 * - MAIL_PROVIDER=gmail-smtp  → SMTP do Gmail com senha de app (não exige domínio)
 *
 * O envio é sempre direto (sem fila): em serverless não existe worker para
 * consumir a fila, e um job enfileirado ficaria parado para sempre.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  private get provider(): string {
    return (this.config.get<string>('MAIL_PROVIDER') || 'resend').trim().toLowerCase();
  }

  private get from(): string {
    return this.config.get<string>('MAIL_FROM') || '"HospedaRN" <noreply@hospedarn.com.br>';
  }

  get providerName(): string {
    return this.provider;
  }

  async send(message: MailMessage): Promise<void> {
    const html = renderMailTemplate(message.template, message.context);

    if (this.provider === 'gmail-smtp') {
      await this.sendViaGmail(message.to, message.subject, html);
      return;
    }

    await this.sendViaResend(message.to, message.subject, html);
  }

  private async sendViaResend(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY ausente para MAIL_PROVIDER=resend');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }

    this.logger.log(`E-mail enviado (resend) para ${to}: ${subject}`);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!user || !pass) {
      throw new Error('SMTP_USER/SMTP_PASS ausentes para MAIL_PROVIDER=gmail-smtp');
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: pass.replace(/\s+/g, '') },
      // Sem pool: cada envio tira uma conexão curta e a fecha, evitando socket
      // pendurado em função serverless.
      pool: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    return this.transporter;
  }

  private async sendViaGmail(to: string, subject: string, html: string): Promise<void> {
    const info = await this.getTransporter().sendMail({
      from: this.from,
      to,
      subject,
      html,
    });

    this.logger.log(`E-mail enviado (gmail) para ${to}: ${info.messageId}`);
  }

  async verify(): Promise<{ provider: string; ok: boolean; detail?: string }> {
    if (this.provider === 'gmail-smtp') {
      try {
        await this.getTransporter().verify();
        return { provider: this.provider, ok: true };
      } catch (error) {
        return {
          provider: this.provider,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      provider: this.provider,
      ok: Boolean(this.config.get<string>('RESEND_API_KEY')),
      detail: this.config.get<string>('RESEND_API_KEY') ? undefined : 'RESEND_API_KEY ausente',
    };
  }
}
