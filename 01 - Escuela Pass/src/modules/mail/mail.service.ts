/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
