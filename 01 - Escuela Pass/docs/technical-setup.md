# Configuracion backend Escuela Pass

## Decision ORM: TypeORM

Se eligio TypeORM para este proyecto por:

- Integracion nativa con NestJS (`@nestjs/typeorm`).
- Buena compatibilidad con PostgreSQL y esquema SQL ya definido.
- Curva de implementacion mas directa para proyecto de grado con enfoque API REST.
- Posibilidad de mapear tablas existentes sin rehacer modelo completo.

Prisma tambien era viable, pero para este caso TypeORM reduce friccion con la BD SQL ya creada.

## Estructura base ya configurada

- `src/main.ts` arranque de Nest + Swagger + pipes globales.
- `src/app.module.ts` carga config global y conexion DB.
- `src/config/env.validation.ts` validacion de `.env`.
- `src/config/typeorm.config.ts` conexion PostgreSQL.
- Modulos:
  - `health`
  - `auth`
  - `access` (escaneo QR/NFC)
  - `circuit` (solicitud de recogida con GPS simple)
  - `notices` / `notifications`
  - `payments`
  - `attendance`

## Endpoints iniciales

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/access-events/scan`
- `POST /api/v1/circuit-requests`
- `GET /api/v1/circuit-requests/today`

## Variables de entorno

Editar `.env` (o copiar desde `.env.example`):

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `CORS_ORIGIN`, `THROTTLE_TTL`, `THROTTLE_LIMIT`
- Opcional: `VOUCHER_MAX_BYTES` (subida de comprobantes)

## Base de datos

1. Crear base de datos en PostgreSQL (ej. `escuela_pass`).
2. Ejecutar en orden:
   - `escuela_pass_schema_v3.sql`
   - `scripts/database/seed_dev.sql` (datos de prueba)

## Flujo QR/NFC web

1. El frontend web genera o presenta QR con `qrcode.js`.
2. El scanner (camara/lector) manda `credentialValue` al backend.
3. Backend valida en `access_credentials`.
4. Si es valido, registra en `access_events`.
5. Para alumno, se respeta 1 `ENTRY` y 1 `EXIT` por dia.

Referencia: [qrcode.js](https://davidshimjs.github.io/qrcodejs/)

---

## Autenticacion JWT (cierre)

Endpoints bajo prefijo `api/v1`:

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Email/password; devuelve `accessToken`, `refreshToken`, `user`. Al hacer login se invalidan refresh tokens anteriores del usuario. |
| POST | `/auth/refresh` | No | Body `{ "refreshToken": "..." }`. Rotacion: el refresh usado se elimina en BD y se emiten tokens nuevos. |
| POST | `/auth/logout` | No | Body `{ "refreshToken": "..." }`. Revoca **todos** los refresh tokens del usuario en BD. |

Swagger: `http://localhost:3000/docs` — usar **Authorize** con `Bearer <accessToken>` en rutas protegidas.

### Rutas protegidas y roles

- `POST /access-events/scan`: JWT + roles `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- `POST /circuit-requests`: JWT + `PADRE`, `ADMIN`, `ADMINISTRATIVO`.
- `GET /circuit-requests/today`: JWT + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.

### Seguridad HTTP

- `helmet` en `main.ts`.
- CORS desde `CORS_ORIGIN` en `.env`.
- Rate limit global con `@nestjs/throttler` (`THROTTLE_TTL`, `THROTTLE_LIMIT`).

---

## Comandos rapidos

```bash
cd "01 - Escuela Pass"
npm install
npm run start:dev
```

- API: `http://localhost:3000/api/v1/health`
- Docs: `http://localhost:3000/docs`

BD: ejecutar `escuela_pass_schema_v3.sql` y opcionalmente `scripts/database/seed_dev.sql`.

---

## Checklist demo / sustentacion (auth + accesos)

1. Login admin → obtener tokens.
2. Authorize en Swagger → `POST /access-events/scan` con credencial seed (ej. `QR_ALUMNO_0001`).
3. Repetir `ENTRY` mismo dia con alumno → debe fallar regla de negocio (400).
4. `POST /auth/logout` con `refreshToken` actual → `Logout exitoso`.
5. `POST /auth/refresh` con el mismo refresh → `401`.

Si hay datos viejos en `refresh_tokens`, en desarrollo se puede vaciar: `DELETE FROM refresh_tokens;`

---

## Avisos y notificaciones (implementado)

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/notices` | JWT + ADMIN, ADMINISTRATIVO, DOCENTE | Crea aviso y genera filas en `notifications` segun `targetType` (ALL / GROUP / USER). |
| GET | `/notices` | JWT + ADMIN, ADMINISTRATIVO, DOCENTE | Lista avisos; docente solo ve los que el creo. |
| GET | `/notifications/me` | JWT (cualquier rol) | Bandeja del usuario. |
| PATCH | `/notifications/:id/read` | JWT | Marca leida. |

Reglas docente: no puede `ALL`; en `GROUP` debe estar en `teacher_groups`; en `USER` el destino debe ser alumno o padre de un alumno de sus grupos.

Body ejemplo `POST /notices` (grupo):

```json
{
  "title": "Reunion de padres",
  "content": "Se convoca el viernes 10:00 hrs.",
  "targetType": "GROUP",
  "targetGroupId": "UUID_DEL_GRUPO",
  "isImportant": true
}
```

---

## Pagos y colegiaturas (implementado)

Flujo: administracion crea **deuda** → padre sube **ruta de comprobante** (`voucherPath`, simula archivo ya guardado en `uploads/`) → **ADMIN** / **ADMINISTRATIVO** **verifica** y se registra fila en `payments` y la deuda pasa a `PAGADO`.

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/payments/concepts` | JWT (varios roles; listar conceptos activos) |
| GET | `/payments/concepts?includeInactive=true` | JWT |
| POST | `/payments/concepts` | ADMIN, ADMINISTRATIVO |
| POST | `/payments/debts` | ADMIN, ADMINISTRATIVO |
| GET | `/payments/debts` | ADMIN, ADMINISTRATIVO |
| GET | `/payments/debts/pending-review` | ADMIN, ADMINISTRATIVO |
| GET | `/payments/debts/mine` | PADRE |
| POST | `/payments/debts/:debtId/voucher` | PADRE (JSON manual `{ "voucherPath": "..." }`, legacy) |
| POST | `/payments/debts/:debtId/voucher/file` | PADRE (**multipart** campo `file`: PDF, JPG, PNG, WEBP; max ~5 MB; guarda en `uploads/comprobantes/`) |
| POST | `/payments/debts/:debtId/verify` | ADMIN, ADMINISTRATIVO |

**Crear deuda (ejemplo):** necesitas `studentId` y `conceptId` (los conceptos base vienen del SQL inicial o de `GET /payments/concepts`).

Los archivos subidos quedan accesibles en el mismo host por URL: `GET /uploads/comprobantes/<nombre>` (solo desarrollo; en producción restringir por roles o CDN privado).

---

## Asistencia (implementado)

Tabla: `attendance_records` (fecha + estudiante; upsert por `student_id` + `attendance_date`).

| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/attendance/register` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/attendance/groups/:groupId?date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/attendance/parent/my-children?date=YYYY-MM-DD` | PADRE |

- **Docente:** solo si existe fila en `teacher_groups` para su `teacher_id` y el `group_id` del alumno (o del listado). El seed base **no** inserta `teacher_groups`; para probar como docente, ejecuta en PostgreSQL (una vez):

```sql
INSERT INTO teacher_groups (teacher_id, group_id)
SELECT t.id, g.id
FROM teachers t
JOIN users u ON u.id = t.user_id
JOIN groups g ON g.name = '1A' AND g.school_year = '2026-2027'
WHERE u.email = 'docente1@escuelapass.local'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_groups tg
    WHERE tg.teacher_id = t.id AND tg.group_id = g.id
  );
```

- **Padre:** solo lectura de asistencia de sus hijos (`GET .../parent/my-children`).

Body ejemplo `POST /attendance/register`:

```json
{
  "studentId": "UUID_DEL_ALUMNO",
  "status": "PRESENTE",
  "attendanceDate": "2026-04-01",
  "notes": "Opcional"
}
```

Valores de `status`: `PRESENTE`, `AUSENTE`, `RETARDO`.

### Pruebas paso a paso (Swagger)

1. Arranca la API: `npm run start:dev` y abre `http://localhost:3000/docs`.
2. **Obtener UUIDs** (pgAdmin o consola SQL): `student id` del alumno seed (`alumno1@escuelapass.local`) y `group id` del grupo `1A` / `2026-2027` (tablas `students`, `groups`).
3. **Admin — registrar:** `POST /auth/login` con `admin@escuelapass.local` / `Admin123*` → copiar `accessToken` → **Authorize** → `POST /attendance/register` con el JSON de arriba y `studentId` real → debe responder con el registro guardado.
4. **Admin — listar por grupo:** `GET /attendance/groups/{groupId}` con query opcional `date=2026-04-01` → lista filas de ese grupo y fecha.
5. **Docente — mismo flujo** tras ejecutar el `INSERT` en `teacher_groups` y login como `docente1@escuelapass.local` / `Docente123*`: mismo `register` y `GET .../groups/:groupId` solo si el docente está asignado al grupo.
6. **Docente sin asignacion:** sin fila en `teacher_groups`, `POST /attendance/register` para un alumno de otro grupo → `403`.
7. **Padre — lectura:** login `padre1@escuelapass.local` / `Padre123*` → `GET /attendance/parent/my-children?date=2026-04-01` → ve asistencias del dia para hijos vinculados.
8. **Repetir registro** mismo alumno y misma fecha con otro `status` → actualiza la fila (upsert), no duplica.

### Pruebas paso a paso (resumen)

1. `npm run start:dev` → abrir `http://localhost:3000/docs`.
2. En pgAdmin/SQL, anotar **UUID** del estudiante `alumno1@...` y del **grupo** `1A` (año `2026-2027`).
3. **Admin:** `POST /auth/login` (`admin@escuelapass.local` / `Admin123*`) → **Authorize** con el `accessToken`.
4. `POST /attendance/register` con `studentId`, `status` (`PRESENTE` \| `AUSENTE` \| `RETARDO`), opcional `attendanceDate` y `notes`.
5. `GET /attendance/groups/{groupId}?date=YYYY-MM-DD` para ver el listado del grupo.
6. **Docente:** ejecutar el `INSERT` en `teacher_groups` que está arriba, luego login `docente1@...` / `Docente123*` y repetir registro/listado (solo su grupo).
7. **Padre:** login `padre1@...` → `GET /attendance/parent/my-children?date=...`.
8. Volver a llamar `register` con el **mismo** alumno y **misma** fecha → debe **actualizar** (upsert), no duplicar.

---

## Calificaciones (MVP implementado)

Tabla: `grades` (upsert por `student_id` + `subject` + `period` + `assessment_name`).

| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/grades/register` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/grades/student/:studentId?period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE, PADRE |
| GET | `/grades/groups/:groupId?period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/grades/parent/my-children?period=...&subject=...` | PADRE |

- **Docente:** solo puede registrar/ver calificaciones de alumnos de grupos asignados en `teacher_groups`.
- **Padre:** en `GET /grades/student/:studentId` solo puede ver estudiantes vinculados por `student_parents`.
- Si se repite la misma combinacion de alumno + materia + periodo + evaluacion, se actualiza la fila existente (no duplica).

Body ejemplo `POST /grades/register`:

```json
{
  "studentId": "UUID_DEL_ALUMNO",
  "subject": "Matematicas",
  "period": "BIM1-2026",
  "assessmentName": "Parcial 1",
  "score": 18.5,
  "maxScore": 20,
  "notes": "Buen desempeño",
  "gradedAt": "2026-04-02T10:30:00.000Z"
}
```

### Pruebas paso a paso (Swagger)

1. Login `admin@escuelapass.local` / `Admin123*` y **Authorize**.
2. `POST /grades/register` con un `studentId` valido y body como el ejemplo.
3. `GET /grades/student/{studentId}` (opcional `period` y `subject`) para confirmar registro.
4. `GET /grades/groups/{groupId}` (opcional `period` y `subject`) para ver notas del grupo.
5. Login `docente1@escuelapass.local` / `Docente123*` (con asignacion en `teacher_groups`) y repetir `register` / `groups`.
6. Login `padre1@escuelapass.local` / `Padre123*` y ejecutar:
   - `GET /grades/parent/my-children`
   - `GET /grades/student/{studentId_de_su_hijo}`
7. Repetir `POST /grades/register` con misma materia/periodo/evaluacion y distinto `score` → debe actualizar (upsert).

---

## Reportes (implementado)

Endpoints bajo prefijo `api/v1`:

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/reports/attendance/today?groupId=...&date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/reports/payments/pending` | ADMIN, ADMINISTRATIVO |
| GET | `/reports/circuit/today?status=...&date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |

Notas:

- `attendance/today`: para DOCENTE aplica la misma regla de `teacher_groups` (solo sus grupos).
- `payments/pending`: devuelve conteos y un listado corto de deudas pendientes (prioriza por `uploadedAt`/`dueDate`).
- `circuit/today`: lista solicitudes del día, con filtro opcional por `status`.

### Pruebas paso a paso (Swagger)

1. Login admin (`admin@escuelapass.local` / `Admin123*`) y **Authorize**.
2. **Asistencia por grupo (GET)**: `GET /reports/attendance/today`
   - Query `groupId`: `UUID_DEL_GRUPO`
   - Query `date` (opcional): `2026-04-02`
3. **Pagos pendientes (GET)**: `GET /reports/payments/pending` (sin body).
4. **Circuito de hoy (GET)**: `GET /reports/circuit/today`
   - Query `status` (opcional): `PENDIENTE` / `NOTIFICADO_LLEGADA` / `AUTORIZADO_SALIR` / `EN_CAMINO` / `ENTREGADO` / `CONSENTIDO_SOLO` / `CANCELADO`
   - Query `date` (opcional): `2026-04-02`
5. Login docente (`docente1@...`) y prueba `GET /reports/attendance/today?groupId=...` para su grupo asignado.

---

## Migraciones TypeORM (baseline)

El proyecto mantiene `escuela_pass_schema_v3.sql` como esquema inicial y, desde ahora, usa migraciones TypeORM para cambios incrementales.

Comandos:

- `npm run migration:show`
- `npm run migration:create`
- `npm run migration:generate`
- `npm run migration:run`
- `npm run migration:revert`

Archivos clave:

- DataSource CLI: `src/config/typeorm.datasource.ts`
- Carpeta de migraciones: `src/database/migrations`
- Baseline inicial: `src/database/migrations/1712050000000-BaselineSchema.ts`

Prerequisito de permisos (usuario de DB que ejecuta migraciones):

```sql
GRANT USAGE, CREATE ON SCHEMA public TO escuela_pass_app;
```

## Siguiente fase recomendada (producto)

1. Circuito vial (transiciones completas) y dashboard/reportes minimos.
2. Frontend web responsive consumiendo estos endpoints.
3. Pruebas e2e minimas sobre pagos + avisos + auth + asistencia + calificaciones.
