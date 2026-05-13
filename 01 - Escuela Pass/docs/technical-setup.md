# Configuración técnica — Escuela Pass

Documento de referencia del **monorepo** backend (NestJS + TypeORM + PostgreSQL) y frontend (React + Vite). La lista exhaustiva de rutas y esquemas de body/query está en **Swagger** (`/docs`) una vez levantada la API.

## Visión general

| Pieza | Ubicación | Notas |
|--------|-----------|--------|
| API | Raíz del proyecto (`src/`) | Node **≥ 20**, NestJS 10, prefijo global `API_PREFIX` (por defecto `api/v1`). |
| Web | `frontend/` | React 18, Vite 6, Tailwind; escaneo con **html5-qrcode**; mapas Mapbox; push FCM opcional. |
| DDL de referencia | `escuela_pass_schema_v4.sql` | Greenfield + `npm run db:apply` (solo esquema, vía `DATABASE_URL`). |
| Cadena TypeORM | `src/database/migrations/` | Baseline + migraciones incrementales; también se ejecutan **al arranque** del proceso (ver abajo). |

### Arranque del backend (`src/main.ts`)

- Crea subcarpetas de uploads (`comprobantes`, `avatars`, `school-logos`, `excuses`) bajo `UPLOADS_DIR` o `./uploads`.
- Migra archivos legacy al volumen si aplica (`migrateUploadsToVolume`).
- **Ejecuta migraciones TypeORM pendientes** en una transacción; si fallan, el proceso no sirve tráfico.
- Llama a `ensureRuntimeSchema` como red de seguridad idempotente (no sustituye migraciones formales).
- Sirve estáticos bajo `/uploads` (primero `UPLOADS_DIR`, fallback `./uploads`).
- `ValidationPipe` global: `whitelist`, `forbidNonWhitelisted`, `transform`.
- `helmet`, CORS (orígenes desde `CORS_ORIGIN`, separados por coma; `credentials: true`), cabeceras expuestas `X-Bulletin-Count` y `Content-Disposition` (PDFs / ZIPs masivos).
- Swagger en **`http://localhost:<PORT>/docs`** (Bearer JWT `access-token`).

## Decisión ORM: TypeORM

Se mantiene TypeORM por integración con Nest (`@nestjs/typeorm`), PostgreSQL y alineación con el DDL de referencia y la cadena de migraciones.

## Estructura modular (backend)

Registrados en `src/app.module.ts`:

- **Core / infra:** `health`, `auth`, `mail` (SMTP global opcional), `uploads` (multipart), `audit`, `privacy`, `schools` (multi-institución, rol `ADMIN` plataforma).
- **Operación:** `access` (QR/NFC/credenciales), `circuit`, `departure-consent`, `vehicles`, `settings`.
- **Comunicación:** `notices`, módulo de `notifications` (bandeja, FCM, informes administrativos con flujo SLA).
- **Académico:** `attendance`, `school-calendar` (ruta HTTP `calendar`), `schedules`, `class-sessions`, `academic-periods`, `activities` (tableros + calificaciones por actividad), `report-cards`, `documents` (PDF boletines / horarios), `attention-notes`, `academic-scheduler` y `event-scheduler` (tareas `@nestjs/schedule`).
- **Personas y carga:** `school` (gestión por escuela: grupos, alumnos, docentes, padres, importaciones Excel).
- **Otros:** `payments`, `reports`, `exports`, `dashboard` + `dashboards`, `meetings`, `external-visits`, `exports`.

Los controladores usan el prefijo global; ejemplo: el módulo de calendario escolar expone **`/api/v1/calendar/...`**, no `/school-calendar/...`.

## Variables de entorno (backend)

Copiar `.env.example` → `.env`. Validación estricta de JWT y de BD: si no hay **`DATABASE_URL`** ni **`POSTGRES_URL`** con prefijo `postgres://` / `postgresql://`, se exigen **`DB_HOST`**, **`DB_PORT`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASS`**.

| Variable | Uso |
|----------|-----|
| `NODE_ENV`, `PORT`, `API_PREFIX` | Entorno, puerto (default 3000), prefijo API. |
| `DATABASE_URL` o `POSTGRES_URL` | Conexión Postgres (recomendada en Railway). |
| `DB_*`, `DB_SSL` | Fallback local si no hay URL directa. |
| `DB_SKIP_EXTENSIONS` | `1`: al aplicar SQL v4 sin `CREATE EXTENSION` (hosts restringidos). |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Auth (refresh único activo por usuario en MVP). |
| `CORS_ORIGIN` | Orígenes permitidos (coma, sin espacios). En local suele incluir el origen del SPA (p. ej. `http://localhost:5173`) además del API si hace falta. |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Rate limit global (`@nestjs/throttler`). |
| `UPLOADS_DIR` | Raíz persistente de archivos (p. ej. `/data` en Railway con volumen). |
| `FIREBASE_SERVICE_ACCOUNT_PATH` / `JSON` (o base64) | Push FCM desde servidor. |
| `INSTITUTION_*` | Perfil por defecto si no hay filas en `institution_settings`. |
| `APP_TIMEZONE` | IANA (p. ej. `America/Mexico_City`); cierre de periodos, actividades y políticas de cartera. |
| `VOUCHER_MAX_BYTES` | Tope opcional comprobantes de pago. |
| `MAPBOX_ACCESS_TOKEN`, `SCHOOL_LATITUDE`, `SCHOOL_LONGITUDE`, `CIRCUIT_ARRIVAL_RADIUS_KM` | Mapa / ETA circuito (informativo). |
| `FRONTEND_URL` | Base del SPA para enlaces en correos y notificaciones (deep links). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo (restablecimiento de contraseña, avisos); sin `SMTP_HOST` el envío se omite con warning en log. |

E2E: además `.env.e2e` puede sobreescribir `DB_NAME` (p. ej. `escuela_pass_test`). Extensiones: `E2E_SKIP_EXTENSIONS` / `DB_SKIP_EXTENSIONS`.

## Base de datos

Hay **dos caminos válidos** para el esquema; no mezclar la aplicación del v4 completo sobre una BD ya gobernada por migraciones sin criterio.

### Opción A — Esquema de referencia v4 (greenfield / desarrollo)

1. Crear la base en PostgreSQL.
2. Definir **`DATABASE_URL`** o **`POSTGRES_URL`** (solo URLs `postgres://` / `postgresql://`; el script `db:apply` no ensambla desde `DB_*` sueltos).
3. `npm run db:apply` — aplica solo DDL idempotente de `escuela_pass_schema_v4.sql` (sin datos).
4. Poblar datos: **`node scripts/seed-full-demo.cjs`** u otros scripts en `scripts/` (solo **desarrollo/staging**; leer cabezales). En `package.json` también existen `npm run db:seed:demo` y `npm run db:seed:railway` como envoltorios.

### Opción B — Cadena TypeORM (base vacía o solo migraciones pendientes)

1. Base vacía (o existente solo con migraciones aplicadas).
2. `npm run migration:run` (CLI: `src/config/typeorm.datasource.ts`; carga `.env` en la raíz del backend).

En **runtime**, al `start` / `start:prod`, el servidor **vuelve a ejecutar** migraciones pendientes antes de escuchar el puerto.

**Bases ya pobladas:** aplicar migraciones incrementales; no re-ejecutar el v4 completo encima.

**Enum `circuit_status` y permisos:** si el usuario de BD no es dueño del tipo, puede fallar la migración `CircuitPadreEnCamino`. Solución documentada en el propio repo: script `scripts/database/ensure-padre-en-camino-enum.sql` o bloque equivalente en baseline; opcional `ALTER TYPE ... OWNER TO ...`.

**Permiso mínimo recomendado para migraciones:**

```sql
GRANT USAGE, CREATE ON SCHEMA public TO escuela_pass_app;
```

### Migraciones (comandos útiles)

- `npm run migration:show` — `migration:create` — `migration:generate` — `migration:run` — `migration:revert`
- Carpeta: `src/database/migrations/` (el baseline inicial sigue siendo `1712050000000-BaselineSchema.ts`, apoyado en `src/database/baseline/typeorm-baseline-v3.sql`).

## Frontend (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE, VITE_MAPBOX_ACCESS_TOKEN, Firebase opcional
npm run dev
```

- **`VITE_API_BASE`**: origen del API sin sufijo `/api` (en local a menudo vacío si se usa proxy de Vite, u `http://localhost:3000`).
- **Mapbox:** token público `pk.` para mapas (circuito, institución).
- **FCM:** variables `VITE_FIREBASE_*` + `VITE_FIREBASE_VAPID_KEY`; **`npm run sync:fcm-sw`** genera `public/firebase-messaging-sw.js` (también en `predev` / `prebuild`).

Referencias útiles: consola Firebase (app web + clave VAPID), cuenta de servicio solo en el backend.

## Autenticación JWT

Prefijo `api/v1`:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/auth/me` | Bearer | Perfil mínimo del usuario autenticado. |
| POST | `/auth/login` | No | `accessToken`, `refreshToken`, `user` (sesión refresh única). |
| POST | `/auth/refresh` | No | Body `{ "refreshToken" }`; rota par. |
| POST | `/auth/logout` | No | Revoca refresh tokens del usuario. |
| POST | `/auth/forgot-password` | No | Solicitud de reset (requiere SMTP para envío real). |
| POST | `/auth/reset-password` | No | Token de reset + nueva contraseña. |

JWT puede incluir **`schoolId`** (`null` para `ADMIN` de plataforma); llega al request como `req.user.schoolId` en guards.

Swagger: botón **Authorize** con `Bearer <accessToken>`.

## Multi-institución (`/schools`)

Solo **`ADMIN`** (plataforma): CRUD de escuelas, asignación de `school_id` a usuarios, alta de administrativos por escuela, listado de usuarios por escuela, reset de contraseña de admin escolar. El resto de módulos filtra datos según el vínculo del usuario con su institución.

## Endpoints destacados (no exhaustivo)

La API evoluciona; para rutas nuevas y DTOs usar **`/docs`**.

### Salud y almacenamiento

- `GET /health` — público.
- `GET /health/storage` — `ADMIN`, diagnóstico de carpeta de uploads.

### Accesos

- `POST /access-events/scan`, `GET /access-events/my-qr`, CRUD/listado credenciales NFC, etc.

### Circuito vial

- `POST /circuit-requests`, `POST /circuit-requests/batch`, `GET /circuit-requests/today`, vistas padre (`.../parent/active`, `.../parent/active-all`), `GET :id/map`, `PATCH :id/gps`, `PATCH :id/parent-progress`, `PATCH :id/teacher-signal`, `PATCH :id/status`, `PATCH :id/cancel`, `PATCH :id/confirm-delivered`.

### Visitas al plantel

Las solicitudes de visita institucional están bajo **`/external-visits`** (sustituyen el antiguo prefijo `/visits` si existía en versiones previas del documento).

### Reuniones padre–docente (`/meetings`)

Incluye `POST`, listados, `GET :id`, `PATCH :id`, reprogramación, cancelación, `POST :id/status`, `POST :id/rsvp`, etc.

### Calendario (`/calendar`)

- Días no lectivos: `GET|POST|DELETE /calendar/non-instructional-days` (alcance por escuela/grupo según implementación).
- Vistas `GET /calendar/me/student`, `GET /calendar/parent/my-children`.

### Asistencia (`/attendance`)

- `POST /attendance/register`, `POST /attendance/register-bulk`, `GET .../groups/:groupId`, `GET .../parent/my-children`, `GET .../parent/my-students`, `POST .../parent/excuse` (justificación).

### Actividades y calificaciones por actividad

- CRUD y tablero bajo **`/activities`**; persistencia de notas: **`POST /activities/:id/grades`** (docente/admin).
- No hay módulo HTTP independiente **`/grades/register`** del documento antiguo; las calificaciones consolidadas para boletines/export enlazan con **periodos académicos** y **report-cards**.

### Periodos y boletines

- **`/academic-periods`**: políticas, alta, cierre, reapertura.
- **`/report-cards`**: listados admin/docente, vistas alumno/padre, `POST .../generate-period/:periodId`, `POST .../generate-final`.
- **`/documents`**: PDFs `bulletin/:reportCardId`, `bulletins/bulk` (cabecera `X-Bulletin-Count`), `schedule/group/:groupId`, `groups/summary`.

### Pagos (`/payments`)

Conceptos (ámbito por escuela), deudas, comprobante archivo o JSON, verificación, rechazo, arreglos, políticas batch, ajustes — ver Swagger.

### Avisos y notificaciones

- **`/notices`**, **`/notifications/me`**, FCM register/unregister, lectura, informes administrativos y comentarios bajo **`/notifications/admin-reports/...`**.

### Gestión escolar (`/school`)

Grupos, materias, estudiantes (incl. transiciones de ciclo de vida e historial), docentes, padres, vínculos alumno–padre, asignaciones `teacher-assignments`, vehículos vinculados a padres, importaciones Excel (incl. `students-to-groups`), plantillas, historial `import/history`.

### Otros

- **`/class-sessions`**, **`/schedules`** (incl. vistas `me/teacher`, `me/student`, `parent/my-children`).
- **`/parents/vehicles`** (padre) y rutas de vehículos desde administración en `school` donde aplique.
- **`/reports`**: asistencia, pagos, circuito, **`access/range`**, **`finance/summary`**.
- **`/exports`**: `attendance.xlsx`, `grades.xlsx`, `bulletin-consolidated.xlsx`.
- **`/dashboard`**: `summary`, `panel`, `actionable-kpis`.
- **`/dashboards/home/:role`** — resumen por rol.
- **`/audit/logs`**, **`/privacy/policy/latest`**, **`/privacy/me/acceptances`**, **`POST /privacy/accept`**.

## Flujo QR/NFC (web)

1. El frontend obtiene o muestra credencial (QR / lector).
2. El cliente envía el valor al backend (`access-events`).
3. Validación contra `access_credentials` y registro en `access_events`.
4. Reglas de negocio de entradas/salidas y sincronización con asistencia cuando aplica (respetando días no lectivos).

## Pagos: archivos subidos

Comprobantes bajo `uploads/comprobantes/` (o subcarpeta bajo `UPLOADS_DIR`). En **producción** conviene CDN privado o políticas de acceso; en desarrollo suelen exponerse vía `/uploads/...`.

## Despliegue (Railway)

Ver `railway.toml` y [`docs/releases/runbook-railway-v1.3.md`](./releases/runbook-railway-v1.3.md): `DATABASE_URL`, JWT, `FRONTEND_URL`, volumen **`UPLOADS_DIR=/data`**, variables de correo/push si se usan. El `startCommand` es `npm run start:prod`.

## Comandos rápidos

**Backend** (desde esta carpeta, `01 - Escuela Pass`):

```bash
npm install
npm run start:dev
```

- API: `http://localhost:3000/api/v1/health` (ajustar puerto si `PORT` cambia).
- Docs: `http://localhost:3000/docs`.

**Calidad:**

- `npm run smoke:build` — `npm run smoke:e2e` — `npm run smoke:ci-local`.

## CI

En el repositorio Git padre: **`.github/workflows/backend-ci.yml`** con `working-directory: 01 - Escuela Pass`, Node 20, `npm ci`, `build` y `test:e2e` contra Postgres servicio.

## Checklist operativo (resumen)

1. `.env` completo (JWT, BD, CORS del front, opcionales SMTP/FCM/Mapbox/FRONTEND_URL/UPLOADS_DIR).
2. BD: migraciones aplicadas (o v4 + seeds solo en dev).
3. Humo: health + login + flujo crítico por rol en Swagger.
4. CI verde en la rama principal.

## Riesgos y evolución

- Revisar dependencias (`npm audit`) en hardening.
- Auth MVP: un refresh activo por usuario; multi-dispositivo explícito queda como mejora.
- `ensureRuntimeSchema` es complementario a migraciones formales, no sustituto en entornos con tráfico.

## Lecturas relacionadas

- [`README.md`](../README.md) — estructura del monorepo y puesta en marcha breve.
- [`docs/releases/README.md`](./releases/README.md) — entregas y runbooks.
- [`docs/CODESTYLE-COMMENTS.md`](./CODESTYLE-COMMENTS.md) — convención de comentarios en código.
