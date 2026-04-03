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
- `PATCH /api/v1/circuit-requests/:id/gps` (padre solicitante)
- `PATCH /api/v1/circuit-requests/:id/confirm-delivered` (padre solicitante o staff)
- `GET /api/v1/circuit-requests/today`
- `GET /api/v1/school/groups` (gestión escolar)
- `GET /api/v1/exports/attendance.csv` (CSV)
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

1. Crear base de datos en PostgreSQL (ej. `escuela_pass`).
2. Ejecutar en orden:
   - `escuela_pass_schema_v3.sql` (incluye tablas `visit_requests`, `parent_teacher_meetings`, `class_schedule_slots`, `school_non_instructional_days`, `institution_settings`)
   - `scripts/database/seed_dev.sql` (datos de prueba)

   Bases ya creadas antes de esta versión: aplicar migraciones TypeORM pendientes (`npm run migration:run`), p. ej. `1775221171718-VisitsMeetingsSchedules`, `1775700000000-SchoolNonInstructionalDays`, `1775800000000-InstitutionSettings`, o ejecutar manualmente el bloque SQL equivalente del esquema.

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
- `PATCH /circuit-requests/:id/confirm-delivered`: JWT + `PADRE`, `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- `GET /circuit-requests/today`: JWT + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE`.
- Rutas bajo `/school/*`: JWT + `ADMIN`, `ADMINISTRATIVO` (grupos, materias, alumnos, docentes, asignaciones `teacher_groups`).
- `GET /exports/attendance.csv` y `GET /exports/grades.csv`: JWT + `ADMIN`, `ADMINISTRATIVO`, `DOCENTE` (misma regla de grupo que reportes para docentes).
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
| POST | `/notifications/fcm/register` | JWT | Registra token de **Firebase Cloud Messaging** del dispositivo (`token`, opcional `platform`). |
| POST | `/notifications/fcm/unregister` | JWT | Elimina el token FCM del usuario (body `{ "token": "..." }`). |
| PATCH | `/notifications/:id/read` | JWT | Marca leida. |

**Push (FCM):** al crear un aviso (`POST /notices`), además de las filas en `notifications`, el backend intenta enviar un mensaje push a cada destinatario que tenga tokens en `user_fcm_tokens`. Requiere credenciales de cuenta de servicio en `.env` (`FIREBASE_SERVICE_ACCOUNT_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON`). Sin credenciales, la API sigue funcionando; solo no habrá push.

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

## Gestión escolar (`/school`)

Prefijo `api/v1`. Requiere JWT con rol `ADMIN` o `ADMINISTRATIVO`.

Incluye CRUD de grupos (`groups`), materias (`subjects`), altas y actualizaciones de alumnos y docentes (tablas `users` + `students` / `teachers`), y asignaciones docente–grupo–materia (`teacher-assignments` → tabla `teacher_groups`).

Ejemplos:

- `GET /school/groups`
- `POST /school/teacher-assignments` con `teacherId`, `groupId`, `subjectId` (opcional), `isMainTeacher`, `canAuthorizeDepartures`
- Importación masiva CSV (multipart, campo `file`):
  - `POST /school/import/groups/csv`
  - `POST /school/import/students/csv`
  - `POST /school/import/teachers/csv`
  - `POST /school/import/teacher-assignments/csv`
  - Query opcional `dryRun=true` para validar sin escribir en BD.

- Plantillas CSV de descarga:
  - `GET /school/import/templates/groups.csv`
  - `GET /school/import/templates/students.csv`
  - `GET /school/import/templates/teachers.csv`
  - `GET /school/import/templates/teacher-assignments.csv`
- Historial de cargas (persistido en tabla `import_jobs`):
  - `GET /school/import/history?limit=20`

Cabeceras esperadas por CSV:

- Grupos: `name,grade,shift,schoolYear,classroom,capacity`
- Alumnos: `email,password,fullName,matricula,groupId,canAccessCampus,canLeaveAlone`
- Docentes: `email,password,fullName,employeeNumber,canAccessCampus`
- Asignaciones: `teacherId,groupId,subjectId,isMainTeacher,canAuthorizeDepartures`

---

## Exportaciones CSV y Excel (`/exports`)

**CSV:** respuesta `Content-Type: text/csv; charset=utf-8` (UTF-8 con BOM para abrir en Excel).

**Excel (.xlsx):** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment` con nombre sugerido (`asistencia-YYYY-MM-DD.xlsx`, `calificaciones-....xlsx`). Mismos datos y reglas que el CSV (incluida la validación de día sin clases para asistencia).

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET | `/exports/attendance.csv?groupId=UUID&date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/exports/attendance.xlsx?groupId=UUID&date=YYYY-MM-DD` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/exports/grades.csv?groupId=UUID&period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE |
| GET | `/exports/grades.xlsx?groupId=UUID&period=...&subject=...` | ADMIN, ADMINISTRATIVO, DOCENTE |

Los filtros `period` y `subject` en calificaciones son opcionales. Para `DOCENTE` aplica la misma regla que en reportes: solo grupos donde tenga fila en `teacher_groups`.

---

## Configuración institucional (`/settings`)

Tabla `institution_settings` (`setting_key`, `value`).

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/settings/circuit` | Todos los roles autenticados | `{ "enabled": boolean }` — si el circuito de recogida acepta nuevas solicitudes (`POST /circuit-requests`). |
| PATCH | `/settings/circuit` | ADMIN, ADMINISTRATIVO | Body `{ "enabled": true \| false }`. Si `enabled` es `false`, `POST /circuit-requests` responde **400** hasta volver a habilitar. Las solicitudes ya creadas siguen su flujo normal. |

---

## Circuito: GPS en ruta (`PATCH /circuit-requests/:id/gps`)

El padre que creó la solicitud puede enviar o actualizar coordenadas mientras el circuito está activo:

- Body JSON: `{ "parentGpsLatitude": number, "parentGpsLongitude": number }` (latitud [-90, 90], longitud [-180, 180]).
- Integración preferida: **Mapbox Directions API** (`MAPBOX_ACCESS_TOKEN`).
- El backend calcula distancia al colegio y, si entra al radio (`CIRCUIT_ARRIVAL_RADIUS_KM`), cambia estado automáticamente a `NOTIFICADO_LLEGADA`.
- Variables recomendadas:
  - `MAPBOX_ACCESS_TOKEN`
  - `SCHOOL_LATITUDE`
  - `SCHOOL_LONGITUDE`
  - `CIRCUIT_ARRIVAL_RADIUS_KM`
- Si Mapbox no está configurado o falla, se usa fallback local con fórmula Haversine para no romper el flujo.
- Confirmación de entrega: `PATCH /circuit-requests/:id/confirm-delivered` (padre dueño de la solicitud o staff) para cerrar el flujo en `ENTREGADO`.
- **Push FCM (padre solicitante):** si Firebase está configurado y el padre tiene token registrado (`POST /notifications/fcm/register`), recibe notificaciones ante cambios de estado del circuito (incluye llegada por GPS al radio del plantel, autorización de salida, en camino, entrega, cancelación, etc.). Payload `data`: `type=circuit`, `circuitRequestId`, `status`.

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

## Visitas, reuniones y horarios

Tablas: `visit_requests`, `parent_teacher_meetings`, `class_schedule_slots`.

**Visitas al plantel**

| Metodo | Ruta | Rol |
|--------|------|-----|
| POST | `/visits` | PADRE (solo hijos en `student_parents`) |
| GET | `/visits/me` | PADRE |
| GET | `/visits` | ADMIN, ADMINISTRATIVO (todo); DOCENTE (solicitudes de alumnos de sus grupos) |
| PATCH | `/visits/:id/status` | ADMIN, ADMINISTRATIVO; DOCENTE con misma regla de grupo |

Estados `status`: `PENDIENTE`, `APROBADA`, `RECHAZADA`, `REALIZADA`, `CANCELADA`. El padre crea en `PENDIENTE`; staff actualiza con `PATCH` (body `{ "status": "APROBADA" }`, etc.).

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
   - Ejecutar `escuela_pass_schema_v3.sql`.
   - Ejecutar `scripts/database/seed_dev.sql`.
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
