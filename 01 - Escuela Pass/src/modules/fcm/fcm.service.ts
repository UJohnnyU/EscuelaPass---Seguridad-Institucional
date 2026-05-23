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

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { In, Repository } from 'typeorm';
import { UserFcmTokenEntity } from '../../database/entities/user-fcm-token.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

const MAX_BODY = 3500;
const FCM_BATCH = 500;
/** Límite práctico del mapa `data` en web (~4 KiB); dejamos margen. */
const FCM_DATA_BYTES_WARN = 3800;

const FCM_TOKEN_INVALID_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
]);

@Injectable()
export class FcmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FcmService.name);
  private messaging: admin.messaging.Messaging | null = null;
  private purgeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(UserFcmTokenEntity)
    private readonly tokenRepository: Repository<UserFcmTokenEntity>
  ) {}

  onModuleInit() {
    const cred = this.loadServiceAccount();
    if (!cred) {
      this.logger.warn(
        'FCM deshabilitado: defina FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON (JSON o base64).'
      );
      return;
    }
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(cred)
        });
      }
      this.messaging = admin.messaging();
      this.logger.log('Firebase Admin inicializado para Cloud Messaging.');
    } catch (err) {
      this.logger.error('No se pudo inicializar Firebase Admin', err);
    }
    this.purgeInterval = setInterval(() => {
      void this.purgeOldDeviceTokens().catch((error: unknown) => {
        this.logger.warn(`FCM: no se pudieron purgar tokens antiguos: ${String(error)}`);
      });
    }, 24 * 60 * 60 * 1000);
    void this.purgeOldDeviceTokens().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.purgeInterval) {
      clearInterval(this.purgeInterval);
      this.purgeInterval = null;
    }
  }

  async registerDeviceToken(userId: string, dto: RegisterFcmTokenDto) {
    const token = dto.token.trim();
    const existing = await this.tokenRepository.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = dto.platform?.trim() ?? null;
      await this.tokenRepository.save(existing);
      return { message: 'Token FCM actualizado', id: existing.id };
    }
    const row = this.tokenRepository.create({
      userId,
      token,
      platform: dto.platform?.trim() ?? null
    });
    const saved = await this.tokenRepository.save(row);
    return { message: 'Token FCM registrado', id: saved.id };
  }

  async unregisterDeviceToken(userId: string, token: string) {
    const t = token.trim();
    const res = await this.tokenRepository.delete({ userId, token: t });
    return { message: 'Token eliminado', removed: res.affected ?? 0 };
  }

  /**
   * Envía push por cada fila de notificación in-app (misma fuente que la bandeja).
   */
  /**
   * Push directo a un usuario (p. ej. circuito vial sin fila en `notifications`).
   */
  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string>
  ): Promise<void> {
    if (!this.messaging) {
      return;
    }
    const rows = await this.tokenRepository.find({ where: { userId } });
    if (rows.length === 0) {
      return;
    }
    const tokens = rows.map((r) => r.token);
    const bodyText = this.truncate(body, MAX_BODY);
    await this.sendMulticastChunks(tokens, title, bodyText, data);
  }

  async sendPushForNotifications(rows: NotificationEntity[]): Promise<void> {
    if (!this.messaging || rows.length === 0) {
      return;
    }
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const allTokens = await this.tokenRepository.find({
      where: { userId: In(userIds) }
    });
    const tokensByUser = new Map<string, string[]>();
    for (const row of allTokens) {
      if (!tokensByUser.has(row.userId)) tokensByUser.set(row.userId, []);
      tokensByUser.get(row.userId)!.push(row.token);
    }

    for (const n of rows) {
      const tokens = tokensByUser.get(n.userId) ?? [];
      if (tokens.length === 0) continue;
      const body = this.truncate(n.message ?? '', MAX_BODY);
      const data: Record<string, string> = {
        type: 'notice',
        notificationId: n.id,
        noticeId: n.noticeId ?? ''
      };
      const lp = n.linkPath?.trim();
      if (lp) data.openPath = lp.startsWith('/') ? lp : `/${lp}`;
      await this.sendMulticastChunks(tokens, n.title, body, data);
    }
  }

  private async sendMulticastChunks(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>
  ) {
    if (!this.messaging) return;
    /** FCM exige valores string en `data` (especialmente en web). */
    const dataStrings = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined || v === null ? '' : String(v)])
    );
    const bodyText = this.truncate(body, MAX_BODY);
    const titleText = this.truncate(title, 200);
    const openPath = this.resolveOpenPath(dataStrings);
    const cirId = dataStrings.circuitRequestId?.trim();
    const cirSt = dataStrings.status?.trim();
    const notifTag =
      dataStrings.notifTag?.trim() ||
      (cirId ? `circuit-${cirId}-${cirSt || 'unknown'}` : '') ||
      (dataStrings.notificationId?.trim() ? `notice-${dataStrings.notificationId.trim()}` : '') ||
      'escuela-pass';
    const dataOnlyRaw: Record<string, string> = {
      ...dataStrings,
      title: titleText,
      body: bodyText,
      openPath,
      notifTag
    };
    const openUrl = this.absoluteAppUrl(openPath);
    if (openUrl) {
      dataOnlyRaw.openUrl = openUrl;
    }
    const dataOnly = this.trimDataPayloadIfNeeded(dataOnlyRaw, openPath);
    const webPushLink = this.absoluteAppUrl(dataOnly.openPath) ?? openUrl;

    const uniqueTokens = [...new Set(tokens.filter((t) => t && String(t).trim()))];

    for (let i = 0; i < uniqueTokens.length; i += FCM_BATCH) {
      const chunk = uniqueTokens.slice(i, i + FCM_BATCH);
      const res = await this.sendMulticastWithBackoff(chunk, dataOnly, webPushLink);
      const successful = chunk.filter((_, idx) => res.responses[idx]?.success);
      if (successful.length > 0) {
        // TODO Fase 7: agregar last_used_at; por ahora updated_at actúa como última actividad conservadora.
        void this.tokenRepository
          .createQueryBuilder()
          .update(UserFcmTokenEntity)
          .set({ updatedAt: new Date() })
          .where('token IN (:...tokens)', { tokens: successful })
          .execute()
          .catch(() => undefined);
      }
    }
  }

  private async sendMulticastWithBackoff(
    initialTokens: string[],
    dataOnly: Record<string, string>,
    webPushLink: string | undefined
  ): Promise<admin.messaging.BatchResponse> {
    let tokens = initialTokens;
    const allResponses = new Map<string, admin.messaging.SendResponse>();
    const retryDelays = [500, 1500, 4500];

    for (let attempt = 0; attempt <= retryDelays.length && tokens.length > 0; attempt++) {
      if (attempt > 0) {
        await this.delay(retryDelays[attempt - 1] ?? 4500);
      }
      try {
        const res = await this.messaging!.sendEachForMulticast({
          tokens,
          data: dataOnly,
          webpush: webPushLink
            ? {
                fcmOptions: { link: webPushLink }
              }
            : undefined
        });
        const retryable: string[] = [];
        res.responses.forEach((response, idx) => {
          const token = tokens[idx];
          if (!token) return;
          if (response.success) {
            allResponses.set(token, response);
            return;
          }
          const code = response.error?.code;
          if (code && FCM_TOKEN_INVALID_CODES.has(code)) {
            allResponses.set(token, response);
            void this.tokenRepository.delete({ token }).catch(() => undefined);
          } else if (attempt < retryDelays.length) {
            retryable.push(token);
          } else {
            allResponses.set(token, response);
          }
        });
        if (res.failureCount > 0) {
          const firstFail = res.responses.find((r) => !r.success);
          this.logger.warn(
            `FCM: ${res.failureCount}/${tokens.length} envíos fallidos${firstFail?.error?.message ? ` (ej.: ${firstFail.error.message})` : ''}`
          );
        }
        tokens = retryable;
      } catch (err) {
        if (attempt >= retryDelays.length) {
          this.logger.warn(`Error enviando FCM multicast: ${String(err)}`);
          for (const token of tokens) {
            allResponses.set(token, {
              success: false,
              error: err as admin.FirebaseError
            });
          }
          tokens = [];
        }
      }
    }

    const responses = initialTokens.map(
      (token) => allResponses.get(token) ?? { success: false }
    ) as admin.messaging.SendResponse[];
    return {
      responses,
      successCount: responses.filter((r) => r.success).length,
      failureCount: responses.filter((r) => !r.success).length
    };
  }

  private async purgeOldDeviceTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const res = await this.tokenRepository
      .createQueryBuilder()
      .delete()
      .where('updated_at < :cutoff', { cutoff })
      .execute();
    if ((res.affected ?? 0) > 0) {
      this.logger.log(`FCM: ${res.affected} token(es) antiguos purgados.`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private loadServiceAccount(): admin.ServiceAccount | null {
    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (jsonEnv) {
      try {
        const parsed =
          jsonEnv.startsWith('{') ? jsonEnv : Buffer.from(jsonEnv, 'base64').toString('utf8');
        return JSON.parse(parsed) as admin.ServiceAccount;
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido (texto o base64).');
        return null;
      }
    }
    if (pathEnv) {
      try {
        const raw = readFileSync(pathEnv, 'utf8');
        return JSON.parse(raw) as admin.ServiceAccount;
      } catch (e) {
        this.logger.error(`No se pudo leer FIREBASE_SERVICE_ACCOUNT_PATH: ${pathEnv}`, e);
        return null;
      }
    }
    return null;
  }

  private truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return `${s.slice(0, max - 3)}...`;
  }

  /** Tamaño aproximado del payload `data` (clave+valor UTF-8), para no superar límites de web push. */
  private approxDataPayloadBytes(d: Record<string, string>): number {
    let n = 0;
    for (const [k, v] of Object.entries(d)) {
      n += Buffer.byteLength(k, 'utf8') + Buffer.byteLength(String(v), 'utf8');
    }
    return n;
  }

  /**
   * Evita mensajes > ~4 KiB que fallan o se truncan en clientes web.
   * Quita `openUrl` duplicado primero, luego acorta `body` en data.
   */
  private trimDataPayloadIfNeeded(
    data: Record<string, string>,
    resolvedOpenPath: string
  ): Record<string, string> {
    let out = { ...data };
    let bytes = this.approxDataPayloadBytes(out);
    if (bytes <= FCM_DATA_BYTES_WARN) return out;

    delete out.openUrl;
    bytes = this.approxDataPayloadBytes(out);
    this.logger.warn(`FCM: payload data ~${bytes} B; se omitió openUrl duplicado para acercar al límite web.`);

    if (bytes > FCM_DATA_BYTES_WARN && out.body) {
      const overhead = bytes - Buffer.byteLength(out.body, 'utf8');
      const room = Math.max(200, FCM_DATA_BYTES_WARN - overhead - 50);
      out = { ...out, body: this.truncate(out.body, room) };
      bytes = this.approxDataPayloadBytes(out);
    }

    if (bytes > FCM_DATA_BYTES_WARN + 200) {
      this.logger.warn(
        `FCM: payload data aún grande (~${bytes} B); revisar link_path u otros campos. openPath=${resolvedOpenPath.slice(0, 80)}…`
      );
    }
    return out;
  }

  /** Ruta bajo el mismo origen que el SPA (p. ej. /app/circuito/uuid). */
  private resolveOpenPath(d: Record<string, string>): string {
    const explicit = d.openPath?.trim();
    if (explicit) return explicit.startsWith('/') ? explicit : `/${explicit}`;
    const deep = d.deepLink?.trim();
    if (deep) return deep.startsWith('/') ? deep : `/${deep}`;
    const route = d.route?.trim();
    if (route) return route.startsWith('/') ? route : `/${route}`;
    const cid = d.circuitRequestId?.trim();
    if (cid) return `/app/circuito/${cid}`;
    const nid = d.notificationId?.trim();
    if (nid) {
      return `/app/modulos/comunicacion?notification=${encodeURIComponent(nid)}`;
    }
    return '/app';
  }

  private absoluteAppUrl(path: string): string | undefined {
    const raw = (process.env.FRONTEND_URL ?? '').trim();
    if (!raw) return undefined;
    const baseNoTrail = raw.replace(/\/$/, '');
    let p = path.startsWith('/') ? path : `/${path}`;
    /** Evitar `.../app/app/circuito/...` cuando FRONTEND_URL ya termina en `/app`. */
    if (/\/app$/i.test(baseNoTrail) && (p === '/app' || p.startsWith('/app/'))) {
      if (p === '/app') return baseNoTrail;
      p = p.slice(4);
    }
    return `${baseNoTrail}${p}`;
  }
}
