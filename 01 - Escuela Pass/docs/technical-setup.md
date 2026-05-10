# Configuracion backend Escuela Pass

## Decision ORM: TypeORM

Se eligio TypeORM para este proyecto por:

- Integracion nativa con NestJS (`@nestjs/typeorm`).
- Buena compatibilidad con PostgreSQL y esquema SQL ya definido.
- Curva de implementacion mas directa para proyecto de grado con enfoque API REST.
- Posibilidad de mapear tablas existentes sin rehacer modelo completo.

Para este caso TypeORM reduce friccion con la BD SQL ya creada.

## Estructura base ya configurada

- `src/main.ts` arranque de Nest + Swagger + pipes globales.
- `src/app.module.ts` carga config global y conexion DB.
- `src/config/env.validation.ts` validacion de `.env`.
- `src/config/typeorm.config.ts` conexion PostgreSQL.
- Modulos:
  - `health`
  - `auth`
  - `access` (escaneo QR/NFC)
  - `circuit` (recogida: padre avanza estados; GPS opcional solo informativo en mapa)
  - `notices` / `notifications`
  - `payments`
  - `attendance`
  - `visits` (solicitudes de visita al plantel)
  - `meetings` (reuniones padre-docente)
  - `schedules` (franjas de horario por grupo)
  - `school-calendar` (días sin clases: feriados / suspensión; no se registra asistencia ni cuenta en exportes)
  - `settings` (configuración institucional, p. ej. habilitar o deshabilitar el circuito de recogida)

## Endpoints iniciales

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/access-events/scan`
- `POST /api/v1/circuit-requests`
- `PATCH /api/v1/circuit-requests/:id/gps` (padre; ubicación opcional, no cambia estado por radio)
- `PATCH /api/v1/circuit-requests/:id/parent-progress` (padre: `PADRE_EN_CAMINO`, `NOTIFICADO_LLEGADA`)
- `PATCH /api/v1/circuit-requests/:id/confirm-delivered` (padre solicitante o staff)
- `GET /api/v1/circuit-requests/today`
- `GET /api/v1/school/groups` (gestión escolar)
- `GET /api/v1/exports/attendance.xlsx` / `grades.xlsx` / `bulletin-consolidated.xlsx` (Excel)
- `GET /api/v1/settings/institution` (perfil para reportes)
- `POST /api/v1/visits`, `GET /api/v1/visits/me`, `GET /api/v1/visits`, `PATCH /api/v1/visits/:id/status`
- `POST /api/v1/meetings`, `GET /api/v1/meetings/me`, `GET /api/v1/meetings`, `PATCH /api/v1/meetings/:id/status`
- `GET /api/v1/schedules/groups/:groupId`, `POST|PATCH|DELETE /api/v1/schedules` (franjas)
- `GET|POST|DELETE /api/v1/calendar/non-instructional-days` (administración: calendario de días sin clases; alcance global o por `groupId`)

**Nota:** `GET /api/v1/attendance/groups/:groupId` y `GET /api/v1/attendance/parent/my-children` devuelven un objeto `{ date, nonInstructionalDay, reasons?, records }` (antes era solo el arreglo de registros; el listado va en `records`).

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

Hay **dos formas válidas** de preparar el esquema en PostgreSQL; elija una y no las mezcle sobre la misma base.

### Opción A — Esquema de referencia v4 (desarrollo rápido / greenfield)

1. Crear la base (ej. `escuela_pass`).
2. Configurar `DATABASE_URL` en `.env`.
3. Ejecutar `npm run db:apply` (aplica [`escuela_pass_schema_v4.sql`](../escuela_pass_schema_v4.sql), DDL idempotente).
4. Opcional: `scripts/database/seed_dev.sql` o flujos de seed demo (solo **desarrollo/staging** — ver cabezales en esos archivos).

### Opción B — Cadena TypeORM (`migration:run` desde base vacía)

1. Crear la base vacía y variables `DB_*` o `DATABASE_URL`.
2. `npm run migration:run`
3. La primera migración aplica el baseline congelado en [`src/database/baseline/typeorm-baseline-v3.sql`](../src/database/baseline/typeorm-baseline-v3.sql); el resto son cambios incrementales en `src/database/migrations/`.

**Bases ya pobladas:** aplicar solo migraciones pendientes (`npm run migration:run`), no volver a ejecutar el v4 completo encima.

**Migración `CircuitPadreEnCamino` y permisos:** si el usuario de BD no es dueño del tipo `circuit_status` (p. ej. el tipo lo creó `postgres` y la app usa `escuela_pass_app`), la migración puede fallar con *debe ser dueño del tipo*. Solución: en pgAdmin, con usuario `postgres`, ejecutar [`scripts/database/ensure-padre-en-camino-enum.sql`](../scripts/database/ensure-padre-en-camino-enum.sql) (o el bloque equivalente al final de `src/database/baseline/typeorm-baseline-v3.sql`). Luego vuelva a `npm run migration:run` (detectará el valor y continuará). Opcional: `ALTER TYPE circuit_status OWNER TO escuela_pass_app;` para que migraciones futuras sobre el enum las ejecute la app.

## Flujo QR/NFC web

1. El frontend web genera o presenta QR con `qrcode.js`.
2. El scanner (camara/lector) manda `credentialValue` al backend.
3. Backend valida en `access_credentials`.
4. Si es valido, registra en `access_events`.
5. Para alumno, se respeta 1 `ENTRY` y 1 `EXIT` por dia.
6. Si el alumno escanea `ENTRY` por QR/NFC, se crea/actualiza automaticamente su asistencia del dia en `attendance_records` con estado `PRESENTE` (traza en `notes`), salvo que la fecha figure en `school_non_instructional_days` para toda la escuela o para el grupo del alumno.

Referencia: [qrcode.js](https://davidshimjs.github.io/qrcodejs/)

---

## Autenticacion JWT (cierre)

Endpoints bajo prefijo `api/v1`:

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Email/password; devuelve `accessToken`, `refreshToken`, `user`. Cada login invalida tokens refresh anteriores del usuario y deja 1 refresh activo. |
| POST | `/auth/refresh` | No | Body `{ "refreshToken": "..." }`. Si el token es valido, rota la sesion y emite nuevo par de tokens. |
| POST | `/auth/logout` | No | Body `{ "refreshToken": "..." }`. Revoca **todos** los refresh tokens del usuario en BD. |

Politica actual (MVP):

- Un usuario mantiene **un refresh activo** en BD.
- Tras `logout`, cualquier refresh previo responde `401`.
- Si se envia un refresh mal formado/invalido en `refresh` o `logout`, responde `401`.
- Evolucion recomendada (fase siguiente): sesion por dispositivo (`sessionId`) para soporte multi-dispositivo con rotacion estricta por sesion.

Swagger: `http://localhost:3000/docs` — usar **Authorize** con `Bearer <accessToken>` en rutas protegidas.

### Rutas protegidas y roles

- `POST /access-events/scan`: JWT + roles `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- `POST /circuit-requests`: JWT + `PADRE`, `ADMIN`, `ADMINISTRATIVO`.
- `PATCH /circuit-requests/:id/gps`: JWT + `PADRE` (solo el padre que creó la solicitud).
- `PATCH /circuit-requests/:id/parent-progress`: JWT + `PADRE` (avance explícito del circuito).
- `PATCH /circuit-requests/:id/confirm-delivered`: JWT + `PADRE`, `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- `GET /circuit-requests/today`: JWT + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- Rutas bajo `/school/*`: JWT + `ADMIN`, `ADMINISTRATIVO` (grupos, materias, alumnos, docentes, asignaciones `teacher_groups`).
- `GET /exports/attendance.xlsx`, `GET /exports/grades.xlsx`, `GET /exports/bulletin-consolidated.xlsx`: JWT + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE` (misma regla de grupo que reportes para docentes).
- Visitas (`/visits`): `POST` y `GET /me` + `PADRE`; listado y cambio de estado + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE` (este solo filas de alumnos de sus grupos en `teacher_groups`).
- Reuniones (`/meetings`): `POST` y `GET /me` + `PADRE`; listado staff (`ADMIN`/`ADMINISTRATIVO` todo, `DOCENTE` solo donde es convocado); `PATCH :id/status` + docente convocado o administración.
- Horarios (`/schedules`): alta/edición/baja + `ADMIN`, `ADMINISTRATIVO`; lectura por grupo + `PADRE` (hijo en el grupo), `DOCENTE` (asignación al grupo) o administración.

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

BD (desarrollo): usar **Opción A** (`npm run db:apply` + `escuela_pass_schema_v4.sql`) u **Opción B** (`migration:run`); luego opcionalmente `scripts/database/seed_dev.sql` (solo dev/staging — ver cabezal del archivo).

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
| POST | `/notifications/fcm/register` | JWT | Registra token de **Firebase Cloud Messaging** del dispositivo (`token`, opcional `platform`). |
| POST | `/notifications/fcm/unregister` | JWT | Elimina el token FCM del usuario (body `{ "token": "..." }`). |
| PATCH | `/notifications/:id/read` | JWT | Marca leida. |

**Push (FCM):** al crear un aviso (`POST /notices`), además de las filas en `notifications`, el backend intenta enviar un mensaje push a cada destinatario que tenga tokens en `user_fcm_tokens`. Requiere credenciales de cuenta de servicio en `.env` (`FIREBASE_SERVICE_ACCOUNT_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON`). Sin credenciales, la API sigue funcionando; solo no habrá push.

### Firebase: configuración para push en navegador (Web FCM)

Hay **dos piezas** independientes:

1. **Cliente web (Vite / `frontend/.env`)** — credenciales **públicas** del proyecto (API Key, App ID, etc.) + **clave VAPID** para Web Push. Sirven para que el navegador obtenga un token y se registre en `POST /notifications/fcm/register`.
2. **Backend (API Nest, `.env` en la raíz del monorepo)** — **cuenta de servicio** de Firebase (JSON privado o ruta al archivo). Solo el servidor debe conocerla; con ella `firebase-admin` envía los mensajes a los tokens guardados.

**En la consola de Firebase** (console.firebase.google.com):

1. Cree un proyecto o use uno existente. En **Configuración del proyecto** → **Sus apps** → **Agregar app** → **Web** (`</>`). Copie el objeto `firebaseConfig` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
2. En **Compilación → Mensajería en la nube (Cloud Messaging)**:
   - Active la API si se solicita.
   - En **Certificados de clave web push** genere un par de claves y copie la **clave pública** (VAPID). Esa es `VITE_FIREBASE_VAPID_KEY` en el frontend.
3. Para el **backend**, en **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada** descargará un JSON. Ese archivo (o su contenido en base64) es lo que va en `FIREBASE_SERVICE_ACCOUNT_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON` (véase `.env.example` en la raíz).

**En el código frontend**: en `frontend/.env` defina:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=BK...  # clave pública web push de la consola
```

Luego ejecute **`npm run sync:fcm-sw`** desde `frontend/` (también se ejecuta automáticamente en `predev` y `prebuild`) para regenerar `public/firebase-messaging-sw.js` con la misma configuración que el cliente. Tras iniciar sesión, el usuario verá el permiso del navegador; si acepta, el token se asocia a su usuario y recibirá push en **cada dispositivo/navegador** donde haya iniciado sesión y concedido permiso.

**Notas:** iOS Safari solo entrega push web de forma fiable si la app está **añadida a inicio** (PWA); en escritorio Chrome/Firefox/Edge suele funcionar en HTTPS o `localhost`. Las notificaciones del sistema complementan la **bandeja** (`GET /notifications/me`); la campana refresca al recibir un push en primer plano.

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
   - Query `status` (opcional): `PENDIENTE` / `PADRE_EN_CAMINO` / `NOTIFICADO_LLEGADA` / `AUTORIZADO_SALIR` / `EN_CAMINO` / `ENTREGADO` / `CONSENTIDO_SOLO` / `CANCELADO`
   - Query `date` (opcional): `2026-04-02`
5. Login docente (`docente1@...`) y prueba `GET /reports/attendance/today?groupId=...` para su grupo asignado.

---

## Gestión escolar (`/school`)

Prefijo `api/v1`. Requiere JWT con rol `ADMIN` o `ADMINISTRATIVO`.

Incluye CRUD de grupos (`groups`), materias (`subjects`), altas y actualizaciones de alumnos y docentes (tablas `users` + `students` / `teachers`), y asignaciones docente–grupo–materia (`teacher-assignments` → tabla `teacher_groups`).

Ejemplos:

- `GET /school/groups`
- `POST /school/teacher-assignments` con `teacherId`, `groupId`, `subjectId` (opcional), `isMainTeacher`, `canAuthorizeDepartures`
- Importación masiva Excel (multipart, campo `file`, primera hoja, fila 1 = encabezados):
  - `POST /school/import/groups/xlsx`
  - `POST /school/import/students/xlsx`
  - `POST /school/import/teachers/xlsx`
  - `POST /school/import/teacher-assignments/xlsx`
  - Query opcional `dryRun=true` para validar sin escribir en BD.

- Plantillas Excel de descarga:
  - `GET /school/import/templates/groups.xlsx`
  - `GET /school/import/templates/students.xlsx`
  - `GET /school/import/templates/teachers.xlsx`
  - `GET /school/import/templates/teacher-assignments.xlsx`
- Historial de cargas (persistido en tabla `import_jobs`):
  - `GET /school/import/history?limit=20`

Cabeceras esperadas (columnas en la primera fila):

- Grupos: `Nombre del grupo`, `Grado`, `Turno`, `Año escolar`, `Aula`, `Cupo` (también se aceptan encabezados en inglés heredados).
- Alumnos: `Correo electrónico`, `Contraseña`, `Nombre completo`, opcional `Id grupo`; sin columna de matrícula (el sistema la genera). Permisos: **Si** / **No** (o true/false).
- Docentes: `Correo electrónico`, `Contraseña`, `Nombre completo`, `Número de empleado`, `Acceso al campus` (Si/No).
- Asignaciones: `Id docente`, `Id grupo`, **Asignatura** (opcional: lista `código · nombre`, código, nombre o UUID; vacío si no aplica materia), `Docente titular`, `Autoriza salidas` (Si/No). Sigue admitiéndose la columna `Id asignatura` como alias.
- Asignar alumnos existentes a grupos: `Matrícula` y datos para ubicar el grupo (`Id grupo` o nombre y año, etc.).

---

## Exportaciones Excel (`/exports`)

**Excel (.xlsx):** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment`. Las hojas incluyen filas de cabecera con nombre de institución (desde `GET /settings/institution` o variables `INSTITUTION_*` en `.env`). Validación de día sin clases para asistencia igual que antes.

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/exports/attendance.xlsx?groupId=UUID&date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/exports/grades.xlsx?groupId=UUID&period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/exports/bulletin-consolidated.xlsx?groupId=UUID&period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE |

Los filtros `period` y `subject` en calificaciones son opcionales. Para `DOCENTE` aplica la misma regla que en reportes: solo grupos donde tenga fila en `teacher_groups`.

---

## Configuración institucional (`/settings`)

Tabla `institution_settings` (`setting_key`, `value`). Claves de perfil: `institution.name`, `institution.address`, `institution.city`, `institution.phone`, `institution.email`, `institution.director_name`, `institution.motto` (además de `circuit.enabled`).

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/settings/institution` | Todos los roles autenticados | Perfil para reportes y PDF (nombre, dirección, etc.). Valores por defecto desde `.env` (`INSTITUTION_NAME`, …) si no hay filas en BD. |
| PATCH | `/settings/institution` | ADMIN, ADMINISTRATIVO | Actualiza campos opcionales del perfil (`name`, `address`, `city`, `phone`, `email`, `directorName`, `motto`). |
| GET | `/settings/circuit` | Todos los roles autenticados | `{ "enabled": boolean }` — si el circuito de recogida acepta nuevas solicitudes (`POST /circuit-requests`). |
| PATCH | `/settings/circuit` | ADMIN, ADMINISTRATIVO | Body `{ "enabled": true \| false }`. Si `enabled` es `false`, `POST /circuit-requests` responde **400** hasta volver a habilitar. Las solicitudes ya creadas siguen su flujo normal. |

---

## Circuito: GPS opcional y avance del padre

- **`PATCH /circuit-requests/:id/gps`:** el padre solicitante envía coordenadas; el backend calcula distancia/ETA (Mapbox o Haversine) para **visualización** en `GET .../map`. **No** cambia el estado por proximidad ni por radio.
- **`PATCH /circuit-requests/:id/parent-progress`:** body `{ "status": "PADRE_EN_CAMINO" | "NOTIFICADO_LLEGADA" }` — transiciones permitidas: `PENDIENTE` → `PADRE_EN_CAMINO` → `NOTIFICADO_LLEGADA`. El docente/administración continúa el flujo con `PATCH .../status` (`AUTORIZADO_SALIR`, `EN_CAMINO`, etc.).
- Variables útiles: `MAPBOX_ACCESS_TOKEN`, `SCHOOL_LATITUDE`, `SCHOOL_LONGITUDE`, `CIRCUIT_ARRIVAL_RADIUS_KM` (referencia en mapa).
- Solicitud con `pickupMethod` `SOLO_CONSENTIMIENTO` crea el registro en estado `CONSENTIDO_SOLO`.
- Confirmación de entrega: `PATCH /circuit-requests/:id/confirm-delivered`.
- **Push FCM:** notificaciones ante cambios de estado del circuito (no hay alertas automáticas por proximidad del vehículo).

---

## Dashboard administrativo (`/dashboard`)

Resumen operativo para panel principal (RF8) bajo prefijo `api/v1`:

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/dashboard/summary?date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO |

Retorna KPI agregados para la fecha solicitada (o día actual):

- Entidades activas (alumnos, docentes, grupos, usuarios activos y usuarios por rol).
- Asistencia del día (total y distribución por estado).
- Pagos (deudas pendientes, vencidas y pendientes con comprobante).
- Circuito vial del día (total y distribución por estado).
- Accesos del día (total y por tipo `ENTRY/EXIT`).

---

## Reuniones y horarios

Tablas: `parent_teacher_meetings`, `class_schedule_slots`.

Las **visitas externas al plantel** (agenda institucional) usan la tabla `external_visits` y los endpoints bajo `/api/v1/external-visits`.

**Reuniones padre-docente**

| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/meetings` | PADRE; el `teacherId` debe tener fila en `teacher_groups` para el grupo del alumno |
| GET | `/meetings/me` | PADRE |
| GET | `/meetings` | ADMIN, ADMINISTRATIVO (todo); DOCENTE (solo reuniones donde es convocado) |
| PATCH | `/meetings/:id/status` | ADMIN, ADMINISTRATIVO; DOCENTE solo en sus reuniones |

Estados: `PENDIENTE`, `CONFIRMADA`, `REALIZADA`, `CANCELADA`. Body `PATCH`: `{ "status": "CONFIRMADA" }` (también `REALIZADA`, `CANCELADA`).

**Horario por grupo**

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/schedules/groups/:groupId` | ADMIN, ADMINISTRATIVO; DOCENTE con `teacher_groups`; PADRE con hijo en ese grupo |
| POST | `/schedules` | ADMIN, ADMINISTRATIVO |
| PATCH | `/schedules/:id` | ADMIN, ADMINISTRATIVO |
| DELETE | `/schedules/:id` | ADMIN, ADMINISTRATIVO |

Body `POST`: `groupId`, `weekday` (0=domingo … 6=sábado), `startTime` / `endTime` (`HH:mm` o `HH:mm:ss`), opcional `subjectId`, `teacherId`, `room`.

---

## Migraciones TypeORM (baseline)

El baseline histórico para `npm run migration:run` en BD **vacía** está en [`src/database/baseline/typeorm-baseline-v3.sql`](../src/database/baseline/typeorm-baseline-v3.sql) (aplicado por `1712050000000-BaselineSchema.ts`). El archivo [`escuela_pass_schema_v4.sql`](../escuela_pass_schema_v4.sql) en la raíz es la **referencia DDL completa** usada por `npm run db:apply`; no sustituye al baseline en la cadena de migraciones sin un replan de migraciones.

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
- Visitas/reuniones/horarios: `src/database/migrations/1775221171718-VisitsMeetingsSchedules.ts`
- Tokens FCM: `src/database/migrations/1775500000000-UserFcmTokens.ts`

Prerequisito de permisos (usuario de DB que ejecuta migraciones):

```sql
GRANT USAGE, CREATE ON SCHEMA public TO escuela_pass_app;
```

---

## Checklist de release MVP (backend)

Antes de cierre/entrega:

1. Variables de entorno
   - Copiar `.env.example` -> `.env`.
   - Confirmar `DB_*`, `JWT_*`, `API_PREFIX`, `CORS_ORIGIN`.
2. Base de datos (dev)
   - **Opción A:** `npm run db:apply` (v4) y opcionalmente `scripts/database/seed_dev.sql`.
   - **Opción B:** BD vacía + `npm run migration:run` (baseline v3 interno + migraciones); seeds opcionales solo en dev.
3. Pruebas locales de humo
   - `npm run smoke:build`
   - `npm run smoke:e2e`
4. Verificacion API manual
   - `npm run start:dev` y revisar `GET /api/v1/health`.
   - Abrir Swagger en `http://localhost:3000/docs` y validar login + flujo base.
5. CI
   - Confirmar workflow `.github/workflows/backend-ci.yml` en verde en push/PR.

### Riesgos abiertos y notas

- Vulnerabilidades npm: revisar con `npm audit` (planificado para fase de hardening final).
- Migraciones TypeORM requieren permisos `USAGE, CREATE` sobre schema `public`.
- Auth en MVP mantiene 1 refresh activo por usuario (multi-dispositivo queda como mejora futura por `sessionId`).

## Siguiente fase recomendada (producto)

1. Circuito vial (transiciones completas) y dashboard/reportes minimos.
2. Frontend web responsive consumiendo estos endpoints.
3. Pruebas e2e minimas sobre pagos + avisos + auth + asistencia + calificaciones.
