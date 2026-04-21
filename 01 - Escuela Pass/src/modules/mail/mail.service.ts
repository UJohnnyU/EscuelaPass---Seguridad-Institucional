import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { In, Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

const emailCooldownMs = new Map<string, number>();
const COOLDOWN_MS = 60_000;

/**
 * Envío de correo HTML opcional (requiere SMTP_*). Sin Host no envía nada.
 * Antispam simple: no reenvía al mismo usuario el mismo asunto en &lt; 60 s.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  private transporter() {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined
    });
  }

  async sendHtmlToUserIds(userIds: string[], subject: string, html: string, throttleKey?: string): Promise<void> {
    const tp = this.transporter();
    if (!tp || userIds.length === 0) return;

    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
    if (!from) {
      this.logger.warn('SMTP_FROM / SMTP_USER no definido; correo omitido');
      return;
    }

    const now = Date.now();
    const keyBase = throttleKey ?? subject;
    const uniqueIds = [...new Set(userIds)];
    const recipients: string[] = [];

    const users = await this.usersRepository.find({
      where: { id: In(uniqueIds) },
      select: { id: true, email: true }
    });
    for (const u of users) {
      if (!u.email?.trim()) continue;
      const ck = `${u.id}:${keyBase}`;
      const last = emailCooldownMs.get(ck) ?? 0;
      if (now - last < COOLDOWN_MS) continue;
      emailCooldownMs.set(ck, now);
      recipients.push(u.email.trim());
    }

    if (recipients.length === 0) return;

    try {
      await tp.sendMail({
        from,
        bcc: recipients,
        subject,
        html
      });
    } catch (err) {
      this.logger.warn(`Envío SMTP fallido: ${String(err)}`);
    }
  }

  /**
   * Un correo por destinatario (CTA con deep-link distinto, p. ej. ?notification=uuid).
   * Respeta el mismo cooldown por usuario/tipo que sendHtmlToUserIds.
   */
  async sendHtmlPerUser(
    items: Array<{ userId: string; html: string }>,
    subject: string,
    throttleKey: string
  ): Promise<void> {
    const tp = this.transporter();
    if (!tp || items.length === 0) return;
    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();
    if (!from) {
      this.logger.warn('SMTP_FROM / SMTP_USER no definido; correo omitido');
      return;
    }
    const now = Date.now();
    const ids = [...new Set(items.map((i) => i.userId))];
    const users = await this.usersRepository.find({
      where: { id: In(ids) },
      select: { id: true, email: true }
    });
    const emailById = new Map(users.map((u) => [u.id, u.email?.trim() ?? '']));
    for (const it of items) {
      const to = emailById.get(it.userId);
      if (!to) continue;
      const ck = `${it.userId}:${throttleKey}`;
      const last = emailCooldownMs.get(ck) ?? 0;
      if (now - last < COOLDOWN_MS) continue;
      emailCooldownMs.set(ck, now);
      try {
        await tp.sendMail({ from, to, subject, html: it.html });
      } catch (err) {
        this.logger.warn(`Envío SMTP fallido (${to}): ${String(err)}`);
      }
    }
  }

  /** Plantilla mínima institucional para notificaciones de eventos. */
  wrapNotice(title: string, body: string, deepLink?: string): string {
    const link = deepLink
      ? `<p><a href="${deepLink}">Abrir en Escuela Pass</a></p>`
      : '';
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.5">
  <h2 style="color:#0f766e">${this.escapeHtml(title)}</h2>
  <p>${this.escapeHtml(body).replace(/\n/g, '<br>')}</p>
  ${link}
  <p style="font-size:12px;color:#64748b">Mensaje generado por Escuela Pass</p>
</body></html>`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
