# ESCUELA PASS — Administración y seguridad escolar

## 08. Documentación API Escuela Pass

**Jhon Kevin Murillo Martínez**  
Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones (APIT)  
Facultad de Ingenierías — Politécnico Colombiano Jaime Isaza Cadavid  

**Tipo de documento:** Anexo documental del trabajo de grado  
**Versión:** 1.0 documental  
**Año:** 2026  

---

**Proyecto:** Escuela Pass — Administración y seguridad escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Resumen académico de endpoints REST  
**Versión:** 1.0 documental  

---

## 1. Propósito

**Nota de acrónimos del anexo.** **API** (Application Programming Interface), **REST** (Representational State Transfer; Fielding, 2000), **HTTP** (Hypertext Transfer Protocol), **HTTPS** (Hypertext Transfer Protocol Secure), **URI** (Uniform Resource Identifier), **JSON** (JavaScript Object Notation), **MIME** (Multipurpose Internet Mail Extensions), **JWT** (JSON Web Token; IETF, 2015), **CORS** (Cross-Origin Resource Sharing), **DTO** (Data Transfer Object), **OpenAPI** (Open API Initiative, 2021), **PDF** (Portable Document Format), **XLSX** (Office Open XML Spreadsheet), **RFC** (Request for Comments).

Este anexo resume la API REST del backend NestJS para el trabajo de grado: dominios, seguridad, formatos de respuesta, trazabilidad por RF y catálogo de rutas inferidas del código. El estilo arquitectónico REST sigue la propuesta de Fielding (2000); la autenticación adopta el formato JWT especificado en el RFC 7519 (IETF, 2015); la seguridad de la API se alinea con las recomendaciones de la OWASP Foundation (2023) en su API Security Top 10. La especificación viva es OpenAPI 3.1.0 / Swagger en `GET /docs` cuando el despliegue la habilita (OpenAPI Initiative, 2021); ante discrepancias de redacción entre este texto y Swagger, prevalece Swagger. Las rutas del cliente que consumen estos contratos están en el **Anexo 06**; el modelo persistido, en el **Anexo 04**. La sección 12 consolida líneas de mejora profesionales y académicas vinculadas a contratos HTTP y documentación de la API.

*[Figura 2. Captura de Swagger/OpenAPI con todas las etiquetas de dominio expandidas. Recomendado: captura del entorno de desarrollo o staging con datos sintéticos.]*

*[Figura 3. Diagrama de seguridad por capas de la API: validación declarativa, autenticación JWT, autorización por rol, limitación global de tasa de peticiones (*throttling*) y entrega autenticada de archivos privados. Recomendado: Lucidchart con asistencia de Lucid AI.]*

---

## 2. Criterio de documentación

- **Prefijo global documental:** `api/v1` (variable `API_PREFIX`; ajustar ejemplos de URL si cambia).
- **Swagger:** documentación interactiva en `/docs` (no bajo `API_PREFIX`; véase `src/main.ts`).
- Este anexo **agrupa por dominio** y enumera métodos; **no** sustituye DTOs, códigos de error por campo ni ejemplos exhaustivos —para el límite de páginas del TDG se recomienda **exportar OpenAPI** o **capturar** `/docs` en anexo gráfico.

---

## 3. Endpoints por dominio (resumen)

| Dominio | Base path (relativo al prefijo) | Operaciones principales |
| --- | --- | --- |
| Autenticación | `auth` | `login`, `me`, `refresh`, `logout`, recuperación y restablecimiento de contraseña |
| Acceso físico | `access-events` | Credenciales QR/NFC, escaneo, asignación |
| Circuito | `circuit-requests` | Solicitudes, GPS, avance, estados, mapa, confirmación de entrega |
| Vehículos y consentimiento | `parents/vehicles`, `departure-consent` | Vehículos familiares y consentimiento de salida (apoyo RF3) |
| Escuela (nómina) | `school` | Grupos, materias, alumnos, docentes, padres, vínculos, importaciones |
| Plataforma multiescuela | `schools` | Instituciones, administradores escolares, asignación de usuarios |
| Asistencia | `attendance`, `class-attendance` | Registro individual y masivo, excusas, asistencia por clase |
| Actividades | `activities` | Actividades, cierre, reapertura, calificaciones por actividad |
| Académico | `academic-periods`, `report-cards`, `documents` | Periodos, boletines, generación de PDFs |
| Pagos | `payments` | Conceptos, deudas, comprobantes, verificación, arreglos, políticas |
| Comunicación | `notices`, `notifications` | Avisos, bandeja, FCM, informes administrativos y SLA |
| Calendario y horarios | `calendar`, `schedules`, `class-sessions` | Días no lectivos, horarios, sesiones de clase |
| Reportes y exportación | `reports`, `exports`, `dashboard`, `dashboards` | KPIs, reportes operativos, Excel |
| Agenda | `external-visits`, `meetings` | Visitas, reuniones, RSVP y estados |
| Soporte | `uploads`, `files`, `audit`, `privacy`, `settings`, `health` | Subidas, archivos privados, auditoría, privacidad, configuración, salud |

---

## 4. Seguridad de la API

- **Bearer JWT** en rutas protegidas (cabecera `Authorization: Bearer`).
- **Roles** por endpoint (`@Roles`, `RolesGuard`); el rol `ADMIN` de plataforma tiene amplios permisos según implementación (**Anexo 01**).
- **Validación** con `ValidationPipe` global y DTOs.
- **Rate limiting** global con `ThrottlerGuard` (umbrales vía entorno).

---

## 5. Formatos de respuesta

- Predominio de **JSON** en respuestas de negocio.
- **Excel:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (rutas `exports` y exportaciones en `school`).
- **PDF:** `application/pdf` (documentos y boletines según ruta).
- **Archivos:** logos pueden exponerse de forma pública bajo `/uploads`; comprobantes, excusas y evidencias sensibles se sirven con autenticación (p. ej. `GET files/:bucket/:filename`), coherente con el **Anexo 03**.

---

## 6. Uso del anexo en el TDG

Para no inflar el documento principal: **exportar** la especificación OpenAPI desde `/docs` o adjuntar **capturas** con todas las etiquetas expandidas. Los **DTO** y esquemas detallados permanecen en Swagger o en el JSON exportado.

---

## 7. Rutas críticas para trazabilidad RF

| RF | Rutas representativas | Notas de rol |
| --- | --- | --- |
| RF1 | `POST auth/login`, `GET auth/me`, `POST auth/refresh`, `POST auth/logout` | Autenticación y sesión |
| RF2 | `POST access-events/scan`, `GET access-events/my-qr` | Personal y flujos de credencial |
| RF3 | `POST circuit-requests`, `GET circuit-requests/today`, `PATCH …/gps`, `PATCH …/status`, `PATCH …/confirm-delivered` | Padre/tutor, docente y administración según reglas |
| RF4 | `school/*`, `schools/*`, `school/import/*` | Gestión escolar y plataforma |
| RF5 | `attendance/*`, `class-attendance/*`, `activities/*`, `report-cards/*`, `documents/*` | Académico y asistencia |
| RF6 | `payments/*`, `uploads/*`, `files/*` | Cartera y comprobantes |
| RF7 | `notices`, `notifications/me`, `notifications/fcm/*`, `notifications/admin-reports/*` | Comunicación y SLA |
| RF8 | `dashboard/*`, `reports/*`, `exports/*` | Panel e informes |

---

## 8. Contratos generales de error HTTP

| Código | Uso típico |
| --- | --- |
| **400** | Datos inválidos, regla de negocio incumplida o estado no permitido. |
| **401** | Falta de autenticación, token inválido o cuenta inactiva. |
| **403** | Rol o relación institucional insuficiente. |
| **404** | Recurso inexistente. |
| **429** | Límite de tasa (*throttling*). |
| **500** | Error no controlado; revisar *logs*. |

---

## 9. Evidencia gráfica recomendada

- Captura de **Swagger** con **Bearer** configurado y tags principales visibles.
- Ejemplo de **login** y de flujo **circuito**; respuesta de **dashboard**; descarga **PDF** o **Excel** con cabeceras relevantes.

[Figura 1. Swagger Escuela Pass con módulos principales]

---

## 10. Catálogo de rutas HTTP (código fuente)

Las filas siguientes se inferieron desde `@Controller` y métodos HTTP en `src/modules/**/*.controller.ts`. Cada **URL completa** ante el cliente es `{origen}/{API_PREFIX}/{ruta relativa}` (p. ej. `http://localhost:3000/api/v1/auth/login`). El recuento **241** coincide con la suma de métodos registrados en controladores al momento de actualizar el inventario del repositorio; al evolucionar el código, regenerar con `npm run tdg:enrich` o contrastar con `/docs`.

| Método | Ruta relativa (sin prefijo) | Archivo controlador |
| --- | --- | --- |
| GET | academic-periods | src/modules/academic-periods/academic-periods.controller.ts |
| POST | academic-periods | src/modules/academic-periods/academic-periods.controller.ts |
| DELETE | academic-periods/:id | src/modules/academic-periods/academic-periods.controller.ts |
| GET | academic-periods/:id | src/modules/academic-periods/academic-periods.controller.ts |
| PATCH | academic-periods/:id | src/modules/academic-periods/academic-periods.controller.ts |
| POST | academic-periods/:id/activate | src/modules/academic-periods/academic-periods.controller.ts |
| POST | academic-periods/:id/close | src/modules/academic-periods/academic-periods.controller.ts |
| POST | academic-periods/:id/reopen | src/modules/academic-periods/academic-periods.controller.ts |
| GET | academic-periods/policy/effective | src/modules/academic-periods/academic-periods.controller.ts |
| GET | access-events/credentials | src/modules/access/access.controller.ts |
| DELETE | access-events/credentials/:id | src/modules/access/access.controller.ts |
| GET | access-events/credentials/assignable-users | src/modules/access/access.controller.ts |
| POST | access-events/credentials/nfc | src/modules/access/access.controller.ts |
| GET | access-events/my-qr | src/modules/access/access.controller.ts |
| POST | access-events/scan | src/modules/access/access.controller.ts |
| GET | activities | src/modules/activities/activities.controller.ts |
| POST | activities | src/modules/activities/activities.controller.ts |
| DELETE | activities/:id | src/modules/activities/activities.controller.ts |
| GET | activities/:id | src/modules/activities/activities.controller.ts |
| PATCH | activities/:id | src/modules/activities/activities.controller.ts |
| POST | activities/:id/close | src/modules/activities/activities.controller.ts |
| POST | activities/:id/grades | src/modules/activities/activities.controller.ts |
| POST | activities/:id/reopen | src/modules/activities/activities.controller.ts |
| GET | activities/parent/my-children | src/modules/activities/activities.controller.ts |
| GET | activities/student/me | src/modules/activities/activities.controller.ts |
| GET | activities/teacher/my-assignments | src/modules/activities/activities.controller.ts |
| GET | attendance/groups/:groupId | src/modules/attendance/attendance.controller.ts |
| POST | attendance/parent/excuse | src/modules/attendance/attendance.controller.ts |
| GET | attendance/parent/my-children | src/modules/attendance/attendance.controller.ts |
| GET | attendance/parent/my-students | src/modules/attendance/attendance.controller.ts |
| POST | attendance/register | src/modules/attendance/attendance.controller.ts |
| POST | attendance/register-bulk | src/modules/attendance/attendance.controller.ts |
| POST | attention-notes | src/modules/attention-notes/attention-notes.controller.ts |
| GET | attention-notes/parent/my-children | src/modules/attention-notes/attention-notes.controller.ts |
| GET | attention-notes/teacher/groups/:groupId | src/modules/attention-notes/attention-notes.controller.ts |
| GET | audit/logs | src/modules/audit/audit.controller.ts |
| POST | auth/forgot-password | src/modules/auth/auth.controller.ts |
| POST | auth/login | src/modules/auth/auth.controller.ts |
| POST | auth/logout | src/modules/auth/auth.controller.ts |
| GET | auth/me | src/modules/auth/auth.controller.ts |
| POST | auth/refresh | src/modules/auth/auth.controller.ts |
| POST | auth/reset-password | src/modules/auth/auth.controller.ts |
| GET | calendar/me/student | src/modules/school-calendar/school-calendar.controller.ts |
| GET | calendar/non-instructional-days | src/modules/school-calendar/school-calendar.controller.ts |
| POST | calendar/non-instructional-days | src/modules/school-calendar/school-calendar.controller.ts |
| DELETE | calendar/non-instructional-days/:id | src/modules/school-calendar/school-calendar.controller.ts |
| GET | calendar/parent/my-children | src/modules/school-calendar/school-calendar.controller.ts |
| POST | circuit-requests | src/modules/circuit/circuit.controller.ts |
| GET | circuit-requests/:id | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/cancel | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/confirm-delivered | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/gps | src/modules/circuit/circuit.controller.ts |
| GET | circuit-requests/:id/map | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/parent-progress | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/status | src/modules/circuit/circuit.controller.ts |
| PATCH | circuit-requests/:id/teacher-signal | src/modules/circuit/circuit.controller.ts |
| POST | circuit-requests/batch | src/modules/circuit/circuit.controller.ts |
| GET | circuit-requests/parent/active | src/modules/circuit/circuit.controller.ts |
| GET | circuit-requests/parent/active-all | src/modules/circuit/circuit.controller.ts |
| GET | circuit-requests/today | src/modules/circuit/circuit.controller.ts |
| POST | class-attendance/bulk | src/modules/class-attendance/class-attendance.controller.ts |
| GET | class-attendance/class/:classSessionId | src/modules/class-attendance/class-attendance.controller.ts |
| GET | class-attendance/parent/me | src/modules/class-attendance/class-attendance.controller.ts |
| POST | class-attendance/register | src/modules/class-attendance/class-attendance.controller.ts |
| GET | class-attendance/student/:studentId | src/modules/class-attendance/class-attendance.controller.ts |
| GET | class-sessions | src/modules/class-sessions/class-sessions.controller.ts |
| POST | class-sessions | src/modules/class-sessions/class-sessions.controller.ts |
| DELETE | class-sessions/:id | src/modules/class-sessions/class-sessions.controller.ts |
| PATCH | class-sessions/:id | src/modules/class-sessions/class-sessions.controller.ts |
| GET | dashboard/actionable-kpis | src/modules/dashboard/dashboard.controller.ts |
| GET | dashboard/panel | src/modules/dashboard/dashboard.controller.ts |
| GET | dashboard/summary | src/modules/dashboard/dashboard.controller.ts |
| GET | dashboards/home/:role | src/modules/dashboard/dashboards.controller.ts |
| POST | departure-consent/parent/set | src/modules/departure-consent/departure-consent.controller.ts |
| GET | departure-consent/parent/today | src/modules/departure-consent/departure-consent.controller.ts |
| GET | departure-consent/staff/group/:groupId | src/modules/departure-consent/departure-consent.controller.ts |
| GET | departure-consent/student/me/today | src/modules/departure-consent/departure-consent.controller.ts |
| GET | documents/bulletin/:reportCardId | src/modules/documents/documents.controller.ts |
| GET | documents/bulletins/bulk | src/modules/documents/documents.controller.ts |
| GET | documents/groups/summary | src/modules/documents/documents.controller.ts |
| GET | documents/schedule/group/:groupId | src/modules/documents/documents.controller.ts |
| GET | exports/attendance.xlsx | src/modules/exports/exports.controller.ts |
| GET | exports/bulletin-consolidated.xlsx | src/modules/exports/exports.controller.ts |
| GET | exports/class-attendance.xlsx | src/modules/exports/exports.controller.ts |
| GET | exports/grades.xlsx | src/modules/exports/exports.controller.ts |
| GET | external-visits | src/modules/external-visits/external-visits.controller.ts |
| POST | external-visits | src/modules/external-visits/external-visits.controller.ts |
| GET | external-visits/:id | src/modules/external-visits/external-visits.controller.ts |
| PATCH | external-visits/:id | src/modules/external-visits/external-visits.controller.ts |
| POST | external-visits/:id/cancel | src/modules/external-visits/external-visits.controller.ts |
| POST | external-visits/:id/realized | src/modules/external-visits/external-visits.controller.ts |
| POST | external-visits/:id/reschedule | src/modules/external-visits/external-visits.controller.ts |
| GET | external-visits/me | src/modules/external-visits/external-visits.controller.ts |
| GET | files/:bucket/:filename | src/modules/files/files.controller.ts |
| GET | health | src/modules/health/health.controller.ts |
| GET | health/storage | src/modules/health/health.controller.ts |
| GET | meetings | src/modules/meetings/meetings.controller.ts |
| POST | meetings | src/modules/meetings/meetings.controller.ts |
| GET | meetings/:id | src/modules/meetings/meetings.controller.ts |
| PATCH | meetings/:id | src/modules/meetings/meetings.controller.ts |
| POST | meetings/:id/cancel | src/modules/meetings/meetings.controller.ts |
| POST | meetings/:id/reschedule | src/modules/meetings/meetings.controller.ts |
| POST | meetings/:id/rsvp | src/modules/meetings/meetings.controller.ts |
| POST | meetings/:id/status | src/modules/meetings/meetings.controller.ts |
| GET | meetings/me | src/modules/meetings/meetings.controller.ts |
| GET | notices | src/modules/notices/notices.controller.ts |
| POST | notices | src/modules/notices/notices.controller.ts |
| GET | notices/critical/read-receipts | src/modules/notices/notices.controller.ts |
| GET | notices/teacher/groups | src/modules/notices/notices.controller.ts |
| GET | notices/teacher/target-users | src/modules/notices/notices.controller.ts |
| PATCH | notifications/:id/read | src/modules/notices/notifications.controller.ts |
| GET | notifications/admin-reports | src/modules/notices/notifications.controller.ts |
| POST | notifications/admin-reports | src/modules/notices/notifications.controller.ts |
| GET | notifications/admin-reports/:reportId/comments | src/modules/notices/notifications.controller.ts |
| POST | notifications/admin-reports/:reportId/comments | src/modules/notices/notifications.controller.ts |
| PATCH | notifications/admin-reports/:reportId/status | src/modules/notices/notifications.controller.ts |
| GET | notifications/admin-reports/mine | src/modules/notices/notifications.controller.ts |
| POST | notifications/admin-reports/sla-reminders/run | src/modules/notices/notifications.controller.ts |
| GET | notifications/admin-reports/sla-summary | src/modules/notices/notifications.controller.ts |
| POST | notifications/fcm/register | src/modules/notices/notifications.controller.ts |
| POST | notifications/fcm/unregister | src/modules/notices/notifications.controller.ts |
| GET | notifications/me | src/modules/notices/notifications.controller.ts |
| GET | notifications/parent/my-children | src/modules/notices/notifications.controller.ts |
| GET | parents/vehicles | src/modules/vehicles/vehicles.controller.ts |
| POST | parents/vehicles | src/modules/vehicles/vehicles.controller.ts |
| DELETE | parents/vehicles/:id | src/modules/vehicles/vehicles.controller.ts |
| PATCH | parents/vehicles/:id | src/modules/vehicles/vehicles.controller.ts |
| DELETE | parents/vehicles/:id/admin | src/modules/vehicles/vehicles.controller.ts |
| PATCH | parents/vehicles/:id/set-active | src/modules/vehicles/vehicles.controller.ts |
| GET | parents/vehicles/by-parent/:parentId | src/modules/vehicles/vehicles.controller.ts |
| GET | payments/concepts | src/modules/payments/payments.controller.ts |
| POST | payments/concepts | src/modules/payments/payments.controller.ts |
| DELETE | payments/concepts/:id | src/modules/payments/payments.controller.ts |
| PATCH | payments/concepts/:id | src/modules/payments/payments.controller.ts |
| POST | payments/concepts/ensure-base | src/modules/payments/payments.controller.ts |
| GET | payments/debts | src/modules/payments/payments.controller.ts |
| POST | payments/debts | src/modules/payments/payments.controller.ts |
| POST | payments/debts/:debtId/arrangement | src/modules/payments/payments.controller.ts |
| POST | payments/debts/:debtId/reject-voucher | src/modules/payments/payments.controller.ts |
| POST | payments/debts/:debtId/verify | src/modules/payments/payments.controller.ts |
| POST | payments/debts/:debtId/voucher | src/modules/payments/payments.controller.ts |
| POST | payments/debts/:debtId/voucher/file | src/modules/payments/payments.controller.ts |
| GET | payments/debts/adjustments | src/modules/payments/payments.controller.ts |
| GET | payments/debts/mine | src/modules/payments/payments.controller.ts |
| GET | payments/debts/pending-review | src/modules/payments/payments.controller.ts |
| POST | payments/debts/policies/run | src/modules/payments/payments.controller.ts |
| POST | privacy/accept | src/modules/privacy/privacy.controller.ts |
| GET | privacy/me/acceptances | src/modules/privacy/privacy.controller.ts |
| GET | privacy/policy/latest | src/modules/privacy/privacy.controller.ts |
| GET | report-cards | src/modules/report-cards/report-cards.controller.ts |
| GET | report-cards/:id | src/modules/report-cards/report-cards.controller.ts |
| POST | report-cards/generate-final | src/modules/report-cards/report-cards.controller.ts |
| POST | report-cards/generate-period/:periodId | src/modules/report-cards/report-cards.controller.ts |
| GET | report-cards/me | src/modules/report-cards/report-cards.controller.ts |
| GET | report-cards/parent/my-children | src/modules/report-cards/report-cards.controller.ts |
| GET | report-cards/student/me | src/modules/report-cards/report-cards.controller.ts |
| GET | reports/access/range | src/modules/reports/reports.controller.ts |
| GET | reports/attendance/classes | src/modules/reports/reports.controller.ts |
| GET | reports/attendance/today | src/modules/reports/reports.controller.ts |
| GET | reports/circuit/today | src/modules/reports/reports.controller.ts |
| GET | reports/finance/summary | src/modules/reports/reports.controller.ts |
| GET | reports/payments/pending | src/modules/reports/reports.controller.ts |
| POST | schedules | src/modules/schedules/schedules.controller.ts |
| DELETE | schedules/:id | src/modules/schedules/schedules.controller.ts |
| PATCH | schedules/:id | src/modules/schedules/schedules.controller.ts |
| GET | schedules/groups/:groupId | src/modules/schedules/schedules.controller.ts |
| GET | schedules/me/student | src/modules/schedules/schedules.controller.ts |
| GET | schedules/me/teacher | src/modules/schedules/schedules.controller.ts |
| GET | schedules/me/teacher/groups | src/modules/schedules/schedules.controller.ts |
| GET | schedules/parent/my-children | src/modules/schedules/schedules.controller.ts |
| GET | school/groups | src/modules/school/school.controller.ts |
| POST | school/groups | src/modules/school/school.controller.ts |
| DELETE | school/groups/:id | src/modules/school/school.controller.ts |
| GET | school/groups/:id | src/modules/school/school.controller.ts |
| PATCH | school/groups/:id | src/modules/school/school.controller.ts |
| POST | school/import/:kind | src/modules/school/school.controller.ts |
| POST | school/import/groups/xlsx | src/modules/school/school.controller.ts |
| GET | school/import/history | src/modules/school/school.controller.ts |
| POST | school/import/students-to-groups/xlsx | src/modules/school/school.controller.ts |
| POST | school/import/students/xlsx | src/modules/school/school.controller.ts |
| POST | school/import/teacher-assignments/xlsx | src/modules/school/school.controller.ts |
| POST | school/import/teachers/xlsx | src/modules/school/school.controller.ts |
| GET | school/import/templates/groups.xlsx | src/modules/school/school.controller.ts |
| GET | school/import/templates/students-to-groups.xlsx | src/modules/school/school.controller.ts |
| GET | school/import/templates/students.xlsx | src/modules/school/school.controller.ts |
| GET | school/import/templates/teacher-assignments.xlsx | src/modules/school/school.controller.ts |
| GET | school/import/templates/teachers.xlsx | src/modules/school/school.controller.ts |
| GET | school/lifecycle-events | src/modules/school/school.controller.ts |
| GET | school/lifecycle-events/export.xlsx | src/modules/school/school.controller.ts |
| GET | school/parents | src/modules/school/school.controller.ts |
| POST | school/parents | src/modules/school/school.controller.ts |
| DELETE | school/parents/:id | src/modules/school/school.controller.ts |
| GET | school/parents/:id | src/modules/school/school.controller.ts |
| PATCH | school/parents/:id | src/modules/school/school.controller.ts |
| POST | school/parents/:parentId/vehicles | src/modules/school/school.controller.ts |
| DELETE | school/parents/:parentId/vehicles/:vehicleId | src/modules/school/school.controller.ts |
| PATCH | school/parents/:parentId/vehicles/:vehicleId | src/modules/school/school.controller.ts |
| GET | school/student-parent-links | src/modules/school/school.controller.ts |
| POST | school/student-parent-links | src/modules/school/school.controller.ts |
| DELETE | school/student-parent-links/:id | src/modules/school/school.controller.ts |
| PATCH | school/student-parent-links/:id | src/modules/school/school.controller.ts |
| GET | school/students | src/modules/school/school.controller.ts |
| POST | school/students | src/modules/school/school.controller.ts |
| DELETE | school/students/:id | src/modules/school/school.controller.ts |
| GET | school/students/:id | src/modules/school/school.controller.ts |
| PATCH | school/students/:id | src/modules/school/school.controller.ts |
| GET | school/students/:id/lifecycle-history | src/modules/school/school.controller.ts |
| POST | school/students/:id/lifecycle-transition | src/modules/school/school.controller.ts |
| GET | school/students/next-matricula | src/modules/school/school.controller.ts |
| GET | school/subjects | src/modules/school/school.controller.ts |
| POST | school/subjects | src/modules/school/school.controller.ts |
| DELETE | school/subjects/:id | src/modules/school/school.controller.ts |
| GET | school/subjects/:id | src/modules/school/school.controller.ts |
| PATCH | school/subjects/:id | src/modules/school/school.controller.ts |
| GET | school/teacher-assignments | src/modules/school/school.controller.ts |
| POST | school/teacher-assignments | src/modules/school/school.controller.ts |
| DELETE | school/teacher-assignments/:id | src/modules/school/school.controller.ts |
| GET | school/teacher-subjects | src/modules/school/school.controller.ts |
| GET | school/teachers | src/modules/school/school.controller.ts |
| POST | school/teachers | src/modules/school/school.controller.ts |
| DELETE | school/teachers/:id | src/modules/school/school.controller.ts |
| GET | school/teachers/:id | src/modules/school/school.controller.ts |
| PATCH | school/teachers/:id | src/modules/school/school.controller.ts |
| GET | school/teachers/:id/lifecycle-history | src/modules/school/school.controller.ts |
| POST | school/teachers/:id/lifecycle-transition | src/modules/school/school.controller.ts |
| GET | schools | src/modules/schools/schools.controller.ts |
| POST | schools | src/modules/schools/schools.controller.ts |
| GET | schools/:id | src/modules/schools/schools.controller.ts |
| PATCH | schools/:id | src/modules/schools/schools.controller.ts |
| POST | schools/:id/admin | src/modules/schools/schools.controller.ts |
| GET | schools/:id/users | src/modules/schools/schools.controller.ts |
| PATCH | schools/:schoolId/users/:userId | src/modules/schools/schools.controller.ts |
| POST | schools/:schoolId/users/:userId/reset-password | src/modules/schools/schools.controller.ts |
| POST | schools/assign-user | src/modules/schools/schools.controller.ts |
| GET | settings/circuit | src/modules/settings/settings.controller.ts |
| PATCH | settings/circuit | src/modules/settings/settings.controller.ts |
| GET | settings/institution | src/modules/settings/settings.controller.ts |
| PATCH | settings/institution | src/modules/settings/settings.controller.ts |
| POST | uploads/reports/evidence | src/modules/uploads/uploads.controller.ts |
| POST | uploads/schools/:schoolId/logo | src/modules/uploads/uploads.controller.ts |
| POST | uploads/users/:userId/avatar | src/modules/uploads/uploads.controller.ts |

Total rutas documentadas en código: **241**.

Para evidencia Swagger: levantar backend, abrir `/docs`, expandir **todas** las etiquetas (tags) y capturar pantalla completa o exportar especificación OpenAPI desde el navegador (JSON) si está expuesto.

---

## 12. Líneas de mejora profesional, académicas y de completitud (API)

Las recomendaciones siguientes surgen de contrastar el **contrato HTTP público** (controladores Nest, OpenAPI y este anexo) con las prácticas de documentación, seguridad percibida y trazabilidad RF/RNF del TDG.

### 12.1 OpenAPI, catálogo §10 y riesgo de deriva

Existen **tres vistas** del mismo producto: el **catálogo tabular** (§10, regenerable con `npm run tdg:enrich` y el consolidado del repositorio), la **especificación Swagger** generada en tiempo de arranque (`SwaggerModule.createDocument` en `src/main.ts`) y los **decoradores** `@ApiTags` / `@ApiOperation` por controlador. No siempre coinciden en nivel de detalle (resumen, ejemplos, códigos de respuesta por ruta).

- **Profesional:** tratar **OpenAPI** como artefacto versionable: exportar JSON en *release* y archivarlo junto al tag Git, o validar en *CI* que el número de operaciones y métodos coincide con un umbral esperado.  
- **Académico:** en defensa oral, explicitar **qué fuente prima** si el PDF del anexo y el Swagger difieren (regla ya fijada: **prevalece Swagger**).

### 12.2 Swagger en producción y evidencia para el TDG

En `src/main.ts`, **Swagger está deshabilitado en `NODE_ENV=production`** salvo `ENABLE_SWAGGER=true`; opcionalmente acotado con `SWAGGER_USER` / `SWAGGER_PASSWORD` (véase **Anexo 03**, §10).

- **Operativo:** en instituciones reales, mantener `/docs` **cerrado** o restringido.  
- **Académico:** para el anexo gráfico, usar **entorno de staging**, **local** con capturas fechadas, o exportación OpenAPI **adjunta** al TDG, evitando exponer superficie de ataque en producción solo por documentación.

### 12.3 Requisito global de seguridad en el documento OpenAPI

La configuración actual incorpora `addSecurityRequirements('access-token')` a nivel de documento. En la práctica, rutas como `POST auth/login` o `POST auth/forgot-password` son **públicas** en cuanto a JWT.

- **Recomendación:** revisar en Swagger que las operaciones públicas declaren explícitamente **sin** esquema Bearer (p. ej. `swagger-ui` coherente con `@ApiBearerAuth()` selectivo), para que integradores y auditores no interpreten mal el contrato.  
- **Académico:** una tabla breve “**rutas públicas vs autenticadas**” en el **Anexo 10** o en este anexo tras §4 refuerza el análisis de amenazas.

### 12.4 Uniformidad del cuerpo de error

La **§8** resume códigos HTTP; el **cuerpo JSON** de error puede variar entre `ValidationPipe` (*Bad Request* con detalle de campos), excepciones de dominio y errores genéricos.

- **Profesional:** adoptar un **formato único** (p. ej. `{ "statusCode", "message", "code" }` o Problem Details *RFC 7807*) y documentarlo en OpenAPI (`@ApiResponse`).  
- **Académico:** vincular ese formato con la **experiencia de usuario** en el **Anexo 06** (mensajes en pantalla) y con pruebas E2E que assertan estructura.

### 12.5 Paginación, filtros y cargas masivas

Rutas de listado e importación masiva (Excel, reportes) pueden impactar **RNF4** (**Anexo 01**).

- **Recomendación:** documentar en OpenAPI parámetros de **paginación** o límites donde existan; donde no existan, justificar riesgo y mitigación (índices, *streaming*, tope en servidor).  
- **Académico:** medir al menos un flujo pesado y consignarlo en el **Anexo 10**.

### 12.6 Versionado del prefijo y evolución compatible

El prefijo `api/v1` es la **única** señal explícita de versión mayor de la API.

- **Recomendación:** plan de **cambios incompatibles** (nuevo prefijo `v2` o cabecera de deprecación) para trabajo futuro.  
- **Académico:** párrafo en **conclusiones** sobre deuda técnica de versionado refuerza madurez del discurso.

### 12.7 Multipart, límites de tamaño y tiempo de respuesta

Subidas (`uploads`, comprobantes, evidencias) dependen de límites de **Multer** / proxy y de variables como `VOUCHER_MAX_BYTES` (**`docs/technical-setup.md`**).

- **Recomendación:** reflejar **límites** y tipos MIME aceptados en OpenAPI (`@ApiConsumes`, esquemas de *request*).  
- **Profesional:** alinear **timeout** de *gateway* (Railway, reverse proxy) con subidas grandes.

### 12.8 Pruebas automatizadas y trazabilidad a operaciones

Los E2E (`test/app.e2e-spec.ts`) ejercitan subconjuntos representativos; no cubren las **241** filas del catálogo.

- **Académico:** matriz **operación OpenAPI ↔ caso E2E ↔ RF** (en **Anexo 10** o **Anexo 00**, §5 si existe) muestra honestidad metodológica.  
- **Profesional:** herramientas opcionales (*contract testing*, *Schemathesis*) como línea futura.

### 12.9 Datos personales en ejemplos y en especificación

OpenAPI con **ejemplos realistas** puede filtrar patrones sensibles si se copian de producción.

- **Recomendación:** usar **datos sintéticos** en ejemplos y en capturas del TDG.  
- **Alineación:** coherente con tratamiento de menores y datos escolares en marco legal del trabajo.

### 12.10 Priorización sugerida

1. **Congelar** export OpenAPI por entrega y enlazarlo al TDG (§12.1–12.2).  
2. Ajustar **documentación de seguridad** por operación (§12.3).  
3. **Uniformar** errores y reflejarlos en Swagger (§12.4).  
4. Cerrar evidencia **RNF4** en listados y exportaciones (§12.5).  
5. Ampliar **matriz pruebas–operaciones** (§12.8).

---

## 13. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—implementación—rutas API; **§12.8** honestidad cobertura. |
| 01 | Criterios medibles y RF1–RF8 que estas rutas materializan; **§12.5–12.6** límites y versión. |
| 03 | Módulos, seguridad, Swagger y *throttling*; **§12.2–12.3**. |
| 04 | Tablas y entidades detrás de cada recurso. |
| 05 | Diagramas de secuencia que estos mensajes HTTP concretan. |
| 06 | Pantallas que consumen estos endpoints; **§12.4** mensajes al usuario. |
| 07 | Instalación, `/docs`, variables y despliegue; **§12.2** entorno de evidencia. |
| 09 | Manual de usuario: pantallas que consumen estos endpoints (**§15**); mensajes **§13**; líneas de mejora **§16**. |
| 10 | Informe de pruebas y métricas: operaciones ↔ E2E (**Anexo 10**, **§14**); **§12.5**, **§12.8**. |

---

*Fin del anexo 08 — Documentación API.*
