import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: admin.messaging.Messaging | null = null;

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
      try {
        /** Solo `data` + webpush.link: click y pestañas en segundo plano; el SW abre `openPath` al pulsar. */
        const res = await this.messaging.sendEachForMulticast({
          tokens: chunk,
          data: dataOnly,
          webpush: webPushLink
            ? {
                fcmOptions: { link: webPushLink }
              }
            : undefined
        });
        if (res.failureCount > 0) {
          const firstFail = res.responses.find((r) => !r.success);
          this.logger.warn(
            `FCM: ${res.failureCount}/${chunk.length} envíos fallidos${firstFail?.error?.message ? ` (ej.: ${firstFail.error.message})` : ''}`
          );
          res.responses.forEach((r, idx) => {
            if (!r.success && r.error?.code && FCM_TOKEN_INVALID_CODES.has(r.error.code)) {
              void this.tokenRepository.delete({ token: chunk[idx] }).catch(() => undefined);
            }
          });
        }
      } catch (err) {
        this.logger.warn(`Error enviando FCM multicast: ${String(err)}`);
      }
    }
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
