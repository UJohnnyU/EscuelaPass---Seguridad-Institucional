# ESCUELA PASS — Administración y seguridad escolar

## 00. Matriz de trazabilidad TDG Escuela Pass

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
**Tipo de documento:** Matriz de control y trazabilidad  
**Versión:** 1.0 documental  

---

## 1. Propósito

Esta matriz documenta la relación entre la propuesta aceptada, la implementación en el repositorio, los endpoints de la interfaz REST (prefijo documental `api/v1`, configurable mediante variable de entorno `API_PREFIX`), las pantallas del frontend y los entregables del trabajo de grado. Su finalidad es hacer verificable el cumplimiento técnico y académico ante el tribunal, evitando descripciones genéricas no sustentadas en artefactos del proyecto.

El detalle exhaustivo de la API REST se presenta en el **Anexo 08 — Documentación de la API**. La matriz siguiente consolida la trazabilidad por requerimiento y amplía la cobertura respecto de funcionalidades incorporadas durante el desarrollo que exceden el texto mínimo de la propuesta. La especificación normativa de requerimientos (RF/RNF, reglas de negocio y criterios de aceptación medibles) se concentra en el **Anexo 01 — Documento de requerimientos**, complementario a esta matriz. El **Anexo 03** sintetiza la **arquitectura de software** (vistas lógica y de despliegue, módulos, integraciones, riesgos mitigados y **§12** sobre limitaciones residuales y líneas de mejora). El **Anexo 04** documenta el **modelo entidad-relación** y el inventario de tablas frente a las **cuarenta y nueve** entidades TypeORM registradas en `buildTypeOrmConfig()`. El **Anexo 05** presenta **diagramas UML** (casos de uso, secuencia del circuito, clases de contexto) y la **relación con pruebas de extremo a extremo** en `test/app.e2e-spec.ts`. El **Anexo 06** consolida **prototipos UI/UX**, inventario de pantallas y **rutas del cliente** en `frontend/src/App.tsx`. El **Anexo 07** reúne **instalación**, **configuración**, **despliegue** y **mantenimiento** del monorepo con remisión a `docs/technical-setup.md` y *runbooks*. El **Anexo 08** consolida el **catálogo REST** (resumen por dominio y **241** rutas inferidas del código, coherente con Swagger `/docs`). El **Anexo 09** documenta el **manual de usuario** por rol, **flujos operativos** y **rutas del cliente** bajo `/app/...`. El **Anexo 10** consolida el **informe de pruebas y métricas** (E2E, CI, riesgos de cobertura, **§13** de mejora del plan de validación y registro para **RNF4/RNF5**). El **Anexo 02** registra las **actas de reunión** entre el autor del trabajo de grado y **AlfaNetworks** como contraparte funcional del producto Escuela Pass.

---

## 2. Matriz RF/RNF — implementación — evidencia

*Convención:* Las rutas API se indican como recursos bajo el prefijo global `api/v1`. Las pantallas corresponden a rutas y componentes del frontend React (aplicación bajo `/app/...` salvo rutas públicas de acceso e identidad).

| Código | Requerimiento | Módulos y evidencia en backend | Rutas API representativas | Pantallas y componentes principales | Estado |
| --- | --- | --- | --- | --- | --- |
| RF1 | Autenticación con roles y *tokens* JWT | `auth`, estrategia JWT, *guards* por rol; flujo de recuperación y restablecimiento de contraseña con envío de correo (SMTP); aceptación de avisos de privacidad y registro de auditoría donde aplica | `POST api/v1/auth/login`, `POST api/v1/auth/refresh`, `POST api/v1/auth/logout`, `POST api/v1/auth/forgot-password`, `POST api/v1/auth/reset-password`; `GET api/v1/privacy/current-policy`, aceptaciones de privacidad | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `AuthProvider`, `ProtectedRoute`, `PrivacyGate` | Cumplido |
| RF2 | Control de accesos por código QR y NFC | `access-events`, credenciales (`QR` y `NFC`), registro de eventos de acceso con método de lectura; asignación de UID NFC a usuario | `POST api/v1/access-events/scan`, `POST api/v1/access-events/credentials/nfc`, consultas de credenciales y eventos | `EscanerAccesoPage`, modales de resultado de lectura | Cumplido |
| RF3 | Circuito de recogida con apoyo de geolocalización | `circuit-requests`, `parents/vehicles`, `departure-consent`, notificaciones; la recogida es operada por **padres o tutores**, no por un conductor institucional | `api/v1/circuit-requests` (creación y ciclo de estados), actualización de ubicación y estados operativos; consentimientos de salida | `CircuitPadrePage`, `CircuitTodayPage`, `CircuitDetailPage`, mapas y seguimiento | Cumplido con precisión de negocio: operador del circuito familiar es padre/tutor |
| RF4 | Gestión escolar institucional | `school`, `schools`, `uploads`, `settings`, importación y catálogos; persistencia de trabajos de importación (`import_job`); en alcance ampliado: multiinstitución y configuración | `api/v1/school/...`, `api/v1/schools/...`, `api/v1/uploads/...`, `api/v1/settings/...` | `SchoolRosterPage`, `SchoolsAdminPage`, `InstitutionPage`, `ImportExportPage` | Cumplido y ampliado |
| RF5 | Asistencia, actividades y calificaciones; boletines | `attendance`, `class-attendance`, `activities`, `academic-periods`, `report-cards`, `documents`, `exports`, `class-sessions`, `schedules` | `api/v1/attendance/...`, `api/v1/class-attendance/...`, `api/v1/activities/...`, `api/v1/report-cards/...`, exportaciones | `CalificacionesDocentePage`, `MisCalificacionesPage`, `BoletinesPage`, `PeriodosAcademicosPage`, `ScheduleHubPage` | Cumplido y ampliado |
| RF6 | Pagos y gestión de colegiaturas (sin pasarela bancaria automática en el alcance documentado) | `payments`, `uploads`, `files`, reportes de cartera; modelo de datos: deudas, pagos, conceptos y ajustes (tablas en el Anexo 04) | `api/v1/payments/...`, carga de comprobantes y archivos privados | `FinanzasPage`, `FinanzasStaffTools` | Cumplido en los términos de la propuesta |
| RF7 | Avisos y notificaciones *push* | `notices`, `notifications`, integración FCM; correo transaccional vía `mail` donde otros módulos lo requieren | `api/v1/notices`, `api/v1/notifications/...`, registro de *tokens* | `NotificationsBadge`, `FcmBootstrap`, bandejas y listados de avisos | Cumplido |
| RF8 | Panel y reportes para la gestión | `dashboard` (resumen institucional), `dashboards` (paneles por rol u homólogos de *home*), `reports`, `exports` | `api/v1/dashboard/...`, `api/v1/dashboards/...`, `api/v1/reports/...`, `api/v1/exports/...` | `AppHomePage`, paneles por rol, exportaciones | Cumplido y ampliado |
| RNF1 | Backend NestJS y persistencia PostgreSQL con TypeORM | `AppModule`, configuración TypeORM, migraciones bajo `src/database/` | `GET api/v1/health` como señal de servicio; configuración desplegada según `railway.toml` y variables de entorno | No aplica pantalla específica | Cumplido |
| RNF2 | Interfaz *responsive* | Frontend React, Vite, diseño por componentes y *shell* de aplicación | Consumo de API desde cliente bajo mismos contratos | `AppShell`, páginas por rol y flujos móviles | Cumplido |
| RNF3 | Seguridad: hash de contraseñas, JWT, validación de entrada, acceso a datos parametrizado, límite de tasa (*rate limiting*) | `auth`, *pipes* globales de validación, políticas de archivos privados; `ThrottlerModule` y `ThrottlerGuard` globales (p. ej. TTL y umbral vía variables de entorno) | Endpoints protegidos con *Bearer* JWT; rutas públicas acotadas | Flujos de login y controles de rol en rutas | Cumplido; uso de HTTPS conforme al despliegue |
| RNF4 | Tiempos de respuesta razonables en operaciones principales | Índices y consultas en reportes y panel; medición dependiente del entorno y carga | Reportes y *dashboard* bajo `reports`, `dashboard` | Paneles y listas en frontend | Caracterización con criterios y resultados en el **Anexo 10** |
| RNF5 | Interfaz comprensible para usuarios institucionales | Navegación por rol, formularios y retroalimentación de error | — | Rutas bajo `/app/modulos/...` y demás secciones | **Anexo 09** (manual por rol); criterios y validación con usuarios en el **Anexo 10** |
| RNF6 | Infraestructura de despliegue | Backend y base en Railway; frontend estático (p. ej. Vercel u homólogo); volumen para archivos según documentación técnica | — | — | Ajustado frente a la mención de *cPanel* en la propuesta inicial; se justifica por compatibilidad con Node.js y PostgreSQL |

**Modelo de datos y anexos relacionados.** La correspondencia entre entidades de persistencia (TypeORM), las tablas en PostgreSQL y las relaciones del dominio se documenta en el **Anexo 04 — Modelo entidad-relación** (agrupación, relaciones clave, **§8** inventario tabla–archivo y **§9** listado de referencia en despliegue). En código, **cuarenta y nueve** archivos `*.entity.ts` bajo `src/database/entities/` coinciden con el arreglo `entities` de `buildTypeOrmConfig()` y constituyen el modelo persistido operativo. Esta matriz y el **Anexo 01** permanecen alineados con ese criterio de recuento. Los contratos de la API REST se detallan en el **Anexo 08**; las vistas de arquitectura y el apartado de **limitaciones y mejoras** (Anexo 03, §12), en el **Anexo 03**; el **manual de usuario** operativo, en el **Anexo 09**; las pruebas, criterios de usabilidad amplios y métricas, en el **Anexo 10**, según corresponda.

### 2.1 Alcance ampliado respecto del texto base de la propuesta

Las siguientes capacidades se implementan en el repositorio y se vinculan con la trazabilidad técnica del producto; se relacionan con objetivos de administración y seguridad escolar sin sustituir la enumeración RF1–RF8 de la FTG. La misma relación se reproduce en el **Anexo 01** (§3.2) para mantener una única fuente operativa entre anexos.

| Área | Módulos backend (NestJS) | Rutas API (prefijo `api/v1`) | Superficie frontend (ilustrativa) |
| --- | --- | --- | --- |
| Multiinstitución y plataforma | `schools` | `schools/...` | `SchoolsAdminPage`, selección de contexto institucional |
| Calendario escolar y días no lectivos | `school-calendar` | `calendar/...` | Módulos académicos y agenda institucional |
| Visitas externas | `external-visits` | `external-visits/...` | `VisitasPage` |
| Reuniones | `meetings` | `meetings/...` | `ReunionesPage` |
| Notas de atención al estudiante | `attention-notes` | `attention-notes/...` | `AnotacionesDocentePage` |
| Privacidad y políticas | `privacy` | `privacy/...` | `PrivacyGate`, flujos de aceptación |
| Auditoría | `audit` | `audit/...` | Consultas para personal autorizado |
| Archivos privados y entrega controlada | `files`, `uploads` | `files/...`, `uploads/...` | Componentes de descarga/visualización con autorización |
| Documentación institucional / generación de documentos | `documents` | `documents/...` | Flujos ligados a documentos y reportes |
| Programación de eventos y horarios | `schedules`, `class-sessions`, `event-scheduler` | `schedules/...`, `class-sessions/...` | `ScheduleHubPage`, vistas de sesión y horario |
| Tareas programadas en servidor | `academic-scheduler`, `event-scheduler`, `ScheduleModule` | Cron y jobs internos (complementan calendario y eventos) | — |
| Recuperación de contraseña y correo | `auth` (forgot/reset, envío SMTP), `mail` (`MailService` para otros módulos) | `auth/forgot-password`, `auth/reset-password`; uso interno de correo desde dominio de eventos y afines | `ForgotPasswordPage`, `ResetPasswordPage` (`/recuperar-contrasena`, `/restablecer-contrasena`) |
| Límite global de peticiones | `ThrottlerModule`, `ThrottlerGuard` (aplicación global) | Configuración vía `THROTTLE_TTL`, `THROTTLE_LIMIT` | — |
| Monitoreo de servicio | `health` | `health` | — |

---

## 3. Mapa hacia objetivos específicos del trabajo de grado

| Objetivo específico (síntesis) | Evidencia principal | Entregables relacionados |
| --- | --- | --- |
| Análisis de requerimientos | RF/RNF, actores, reglas de negocio y esta matriz | Anexos 00, 01, 02 |
| Diseño de arquitectura, datos e interfaz | Diagramas, modelo entidad-relación, UML, prototipos | Anexos 03, 04, 05, 06 |
| Implementación del backend | Módulos NestJS, TypeORM, migraciones, documentación OpenAPI en tiempo de ejecución | Anexos 03 y 08 |
| Desarrollo del frontend | React, rutas por rol, integración con API | Anexos 06, 09 |
| Validación | Pruebas automatizadas *end-to-end*, pruebas de humo y métricas según Anexo 10 | Anexo 10 |

---

## 4. Inconsistencias entre propuesta y desarrollo — justificación técnica

- **Mapas:** La propuesta menciona Google Maps o Mapbox; la implementación utiliza **Mapbox** y, para cálculos de distancia sin mapa interactivo, aproximación **Haversine** donde aplica el dominio del circuito.
- **Generación y lectura de QR:** La propuesta alude a *qrcode.js*; el producto emplea **html5-qrcode** para escaneo en dispositivo y **qrcode.react** para representación visual de códigos, manteniendo el cometido funcional.
- **Infraestructura:** La propuesta refería *cPanel*; el despliegue efectivo utiliza **Railway** para API y PostgreSQL (y volumen para persistencia de archivos según configuración) y alojamiento estático para el frontend (p. ej. **Vercel** u equivalente), lo cual se fundamenta por compatibilidad con el *stack* Node.js y la base de datos relacional.
- **Circuito vial:** Puede registrarse automáticamente la proximidad (*NOTIFICADO_LLEGADA* u homólogo); la **autorización de salida**, el avance operativo y la **confirmación de entrega** permanecen como acciones explícitas de los actores autorizados.
- **Alcance funcional:** Se incorporan los módulos y flujos listados en la sección 2.1, alineados con administración, comunicación, privacidad y trazabilidad institucional, **incluidos** correo transaccional, programación de tareas en servidor y *rate limiting* global.
- **Transparencia arquitectónica:** Las **limitaciones residuales** (sesión JWT en almacenamiento web, convivencia migraciones / saneo de esquema en arranque, estrategia de pruebas e2e predominante, integraciones opcionales) y las **líneas de mejora** profesional se sistematizan en el **Anexo 03, §12**.

---

## 5. Trazabilidad por flujos operativos

Las validaciones de la última columna se apoyan, cuando corresponde, en las especificaciones *end-to-end* del repositorio (carpeta `test/`), en particular `app.e2e-spec.ts`, `phase7-closure.e2e-spec.ts` y `auth-throttle-ip.e2e-spec.ts`, entre otras. El plan de pruebas, criterios ampliados y resultados se exponen en el **Anexo 10**.

| Flujo | Actores | Evidencia backend | Evidencia frontend | Validación |
| --- | --- | --- | --- | --- |
| Identificación y sesión | Todos los roles | `auth`, validación JWT, renovación y cierre de sesión; recuperación y restablecimiento de contraseña | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `AuthProvider`, `ProtectedRoute` | `test/app.e2e-spec.ts`; límites de petición en `test/auth-throttle-ip.e2e-spec.ts` |
| Escaneo de acceso institucional | ADMIN, ADMINISTRATIVO, DOCENTE | `access-events`, credenciales QR y NFC, persistencia de eventos | `EscanerAccesoPage`, retroalimentación de lectura | `test/app.e2e-spec.ts` (escaneo y vínculo con asistencia); `test/phase7-closure.e2e-spec.ts` (deduplicación de escaneos y credenciales) |
| Circuito de recogida familiar | PADRE, DOCENTE, ADMINISTRATIVO | `circuit-requests`, `parents/vehicles`, `departure-consent`, notificaciones | `CircuitPadrePage`, `CircuitTodayPage`, `CircuitDetailPage` | Escenarios de circuito en `test/app.e2e-spec.ts` |
| Asistencia diaria y por clase | DOCENTE, ADMINISTRATIVO, padres/alumnos según pantalla | `attendance`, `class-attendance`, reportes de asistencia | Vinculadas a módulos académicos y reportes | `test/app.e2e-spec.ts` |
| Calificaciones, actividades y boletines | DOCENTE, ALUMNO, PADRE, administración | `activities`, `report-cards`, `documents`, `exports` | `CalificacionesDocentePage`, `MisCalificacionesPage`, `BoletinesPage` | `test/app.e2e-spec.ts` |
| Pagos y comprobantes | PADRE, ADMINISTRATIVO | `payments`, `uploads`, `files` | `FinanzasPage`, `FinanzasStaffTools` | `test/app.e2e-spec.ts` |
| Comunicación, avisos y *push* | Según rol | `notices`, `notifications`, FCM en cliente | Bandejas, *badge* de notificaciones | `test/app.e2e-spec.ts` y pruebas según entorno (Anexo 10) |
| Visitas y reuniones | Personal autorizado | `external-visits`, `meetings` | `VisitasPage`, `ReunionesPage` | `test/app.e2e-spec.ts` (visitas, reuniones y flujos relacionados) |
| Privacidad y cumplimiento de aceptación | Todos / personal de tratamiento | `privacy`, `audit` | `PrivacyGate`, flujos de política | `test/phase7-closure.e2e-spec.ts` |
| Calendario y periodos | Administración, docentes | `school-calendar`, `academic-periods` | `PeriodosAcademicosPage`, integración en módulos | `test/app.e2e-spec.ts` |
| Multiinstitución | ADMIN de plataforma | `schools` | `SchoolsAdminPage` | `test/app.e2e-spec.ts` |

---

## 6. Alcance de este anexo respecto del texto desarrollado

Este anexo concentra la **trazabilidad detallada** entre requerimientos, implementación, rutas de API, interfaz y pruebas. Su articulación con el texto desarrollado del trabajo de grado se ajusta a las **normas institucionales** de extensión, citación y anexos del programa, pudiendo la matriz citarse como evidencia tabular sin transcripción íntegra cuando proceda.

---

*Fin del anexo 00 — Matriz de trazabilidad.*
