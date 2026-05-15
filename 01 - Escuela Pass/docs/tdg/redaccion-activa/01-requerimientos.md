# ESCUELA PASS — Administración y seguridad escolar

## 01. Documento de requerimientos Escuela Pass

**Jhon Kevin Murillo Martínez**  
Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones (APIT)  
Facultad de Ingenierías — Politécnico Colombiano Jaime Isaza Cadavid  

**Tipo de documento:** Anexo documental del trabajo de grado  
**Año:** 2026  

---

**Proyecto:** Escuela Pass — Administración y seguridad escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Especificación funcional y no funcional  
**Versión:** 1.0 documental  

---

## 1. Introducción

Escuela Pass es una aplicación web institucional de AlfaNetworks orientada a la administración y seguridad escolar. La solución combina una API NestJS con PostgreSQL, una SPA React/Vite, control de acceso por QR/NFC, circuito de recogida iniciado por padres o tutores, comunicación por avisos y notificaciones, gestión académica, pagos, reportes y despliegue en nube.

La interpretación oficial del RF3 es que los padres o tutores actúan como conductores del circuito de recogida desde la aplicación web móvil; no se trata de una flota independiente de vehículos escolares administrada por terceros. La geolocalización se usa como apoyo informativo para el mapa y la estimación de llegada y puede registrar automáticamente la llegada al radio del plantel; las autorizaciones institucionales y la confirmación final continúan siendo acciones explícitas.

La enumeración RF1–RF8 y RNF1–RNF6 de la FTG se expresa aquí en términos de negocio y de aceptación. La **matriz de trazabilidad (Anexo 00)** vincula estos requerimientos con módulos, rutas y pruebas del repositorio; el **modelo entidad–relación (Anexo 04)** documenta **cuarenta y nueve** entidades TypeORM en `buildTypeOrmConfig()`, con definición en igual número de archivos `*.entity.ts` bajo `src/database/entities/`. El **Anexo 03, §12** registra **limitaciones técnicas residuales** y supuestos (p. ej. sesión en cliente, integraciones opcionales, estrategia de pruebas) que acotan la lectura del cumplimiento sin contradicción con los RF/RNF. Este anexo prioriza el *qué* y el *bajo qué condiciones*, sin sustituir los inventarios técnicos de los anexos posteriores.

### 1.1. Pregunta de investigación (texto de la propuesta)

La propuesta formal plantea la siguiente pregunta, la cual orienta el alcance y la argumentación del trabajo de grado en su conjunto (cuerpo principal y anexos):

> ¿Cómo el desarrollo de una aplicación web de AlfaNetworks basada en arquitecturas escalables con NestJS, PostgreSQL, tecnologías NFC y QR puede optimizar los procesos de seguridad física, protección de datos sensibles y administración escolar en instituciones educativas privadas de México, cumpliendo con los estándares normativos de protección de datos personales?

Los requerimientos RF/RNF y las reglas de este documento constituyen la operacionalización técnica y documental de esa pregunta; el marco legal aplicable al tratamiento de datos en el caso mexicano se desarrolla en el **capítulo de Marco referencial** del texto principal del TDG (LFPDPPP y normativa conexa). Los **cinco objetivos específicos** aprobados en la **FTG** se desarrollan en el TDG sin añadir objetivos formales adicionales; los anexos son **entregables** bajo esos cinco objetivos.

---

## 2. Actores del sistema

| Actor | Rol técnico | Responsabilidades principales |
| --- | --- | --- |
| Administrador de plataforma | ADMIN | Configuración transversal, gestión de escuelas, usuarios administrativos y auditoría. |
| Personal administrativo | ADMINISTRATIVO | Gestión escolar, pagos, calendario, reportes, visitas y operación institucional. |
| Docente | DOCENTE | Registro de asistencia, actividades, calificaciones, anotaciones, horarios y apoyo al circuito. |
| Padre o tutor | PADRE | Circuito de recogida, consulta académica de hijos, pagos, reuniones, visitas y notificaciones. |
| Alumno | ALUMNO | Consulta de horario, boletines, actividades y credenciales de acceso cuando aplica. |

*Matiz institucional:* el rol `ADMIN` incluye el administrador de **plataforma** con alcance **multi-escuela** cuando, en el modelo de datos, el usuario no está acotado a una única institución (`school_id` nulo según diseño). Los roles `ADMINISTRATIVO`, `DOCENTE`, `PADRE` y `ALUMNO` operan, en la generalidad de los flujos, **vinculados a una escuela** y a sus relaciones de grupo, hijo o asignación docente, salvo rutas explícitas de plataforma documentadas en el **Anexo 08**.

---

## 3. Requerimientos funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RF1 | Autenticación con roles JWT | Cumplido |
| RF2 | Control de accesos QR/NFC | Cumplido |
| RF3 | Circuito de recogida con GPS | Cumplido con ajuste: conductor = padre/tutor |
| RF4 | Gestión escolar | Ampliado |
| RF5 | Asistencia y calificaciones | Ampliado |
| RF6 | Pagos y colegiaturas | Cumplido sin pasarela automática |
| RF7 | Avisos y notificaciones | Cumplido |
| RF8 | Panel y reportes administrativos | Ampliado |

### 3.1 Reglas transversales

- Todo flujo protegido requiere autenticación JWT mediante *header* `Authorization: Bearer`, salvo rutas públicas explícitas: `POST` *login*, *refresh*, *logout*, *forgot-password*, *reset-password*, verificación de salud (`GET` *health*) y recursos públicos documentados (p. ej. logos donde aplica).
- Los permisos se definen por rol; `ADMIN` tiene alcance global y los demás roles se restringen por escuela, grupo, hijo o asignación docente.
- La información académica y financiera se consulta según pertenencia institucional y relaciones padre–estudiante.
- Las operaciones de archivo se limitan a tipos y tamaños permitidos; las cargas se almacenan en volumen persistente o carpeta local según despliegue.
- Ante exceso de peticiones según límite global configurado, la API puede responder `429 Too Many Requests` (*rate limiting* documentado en implementación).

### 3.2 Alcance ampliado respecto del texto base de la propuesta

Las capacidades siguientes **complementan** la FTG sin sustituir la numeración RF1–RF8: delimitan expectativas de producto frente al repositorio. La tabla siguiente replica la del **Anexo 00, §2.1** para mantener una sola **fuente operativa** entre ambos anexos del paquete del trabajo de grado.

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

## 4. Requerimientos no funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RNF1 | NestJS y PostgreSQL | Cumplido |
| RNF2 | Diseño *responsive* | Cumplido |
| RNF3 | Seguridad: hash de contraseñas, JWT, validación de entrada, consultas parametrizadas, límite de tasa | Cumplido; HTTPS conforme al despliegue |
| RNF4 | Tiempos de respuesta razonables en operaciones principales | Caracterización con criterios y mediciones en el **Anexo 10** |
| RNF5 | Interfaz comprensible | Manual de usuario (**Anexo 09**) y criterios / validación con usuarios en el **Anexo 10** |
| RNF6 | *Hosting* proporcionado | Ajustado frente a *cPanel* propuesto (despliegue compatible con Node.js y PostgreSQL) |

La **especificación ejecutable** de la API REST se expone además en **OpenAPI/Swagger** (`GET /docs` cuando está habilitado en el despliegue), la cual complementa el catálogo del **Anexo 08** y debe prevalecer ante discrepancias menores de redacción en texto estático.

---

## 5. Criterios de aceptación por requerimiento

| Código | Criterio de aceptación (síntesis funcional) |
| --- | --- |
| RF1 | Un usuario válido inicia sesión, recibe *tokens*, accede al perfil autenticado y no puede operar rutas fuera de su rol; recuperación de contraseña completa el flujo acordado cuando el correo está configurado. |
| RF2 | Un escaneo QR o NFC válido registra entrada o salida y deja traza; credenciales inválidas o ajenas al contexto institucional son rechazadas. |
| RF3 | Un padre o tutor crea solicitud, actualiza avance y ubicación cuando aplica; el personal visualiza el estado y se confirma o cancela según reglas de negocio. |
| RF4 | La administración crea y actualiza grupos, materias, estudiantes, docentes, padres y asignaciones dentro de los límites de su rol e institución; los flujos de importación masiva dejan trazabilidad de trabajo en persistencia (`import_job` / Anexo 04). |
| RF5 | Docente o administración registra asistencia y calificaciones; padre o alumno consultan información autorizada. |
| RF6 | La administración gestiona deudas y conceptos; el padre o tutor autorizado carga comprobante; la administración verifica o rechaza sin pasarela bancaria automática. |
| RF7 | Un aviso institucional genera consulta en bandeja; si el cliente registra *token* FCM, puede recibir notificación *push* según configuración; el personal autorizado puede gestionar **reportes administrativos** ligados a la comunicación institucional. |
| RF8 | Panel y reportes entregan indicadores operativos y exportaciones permitidas al rol. |

### 5.1 Criterios medibles y trazabilidad técnica (Anexos 03, 06 y 08)

Los **módulos backend** citados corresponden a los *bounded contexts* registrados en `AppModule`, exhaustivos en el **Anexo 03** del paquete TDG. Las **rutas HTTP** se consignan con el prefijo documental global **`api/v1`** (variable `API_PREFIX`) y se detallan en el **Anexo 08** y en la especificación viva Swagger (`GET /docs`). Las **rutas de interfaz** corresponden al **Anexo 06** (árbol en `frontend/src/App.tsx`); aquí se expresan con prefijo `/app/...` salvo páginas públicas. Las **vistas de arquitectura** (lógica, despliegue, persistencia) se exponen en el **Anexo 03**, sin duplicar aquí diagramas extensos.

| Código | Criterio medible (HTTP / regla) | Módulos backend (Anexo 03) | Rutas API representativas (Anexo 08) | Rutas y pantallas UI (Anexo 06) |
| --- | --- | --- | --- | --- |
| RF1 | `POST .../auth/login` responde **200** con *tokens* ante credenciales válidas; **401** ante credenciales inválidas o cuenta inactiva. `GET .../auth/me` con *Bearer* válido responde **200**. `POST .../auth/forgot-password` y `POST .../auth/reset-password` completan el flujo documentado. Aceptación de políticas bajo `.../privacy/*`. | `AuthModule`, `PrivacyModule`, `AuditModule` (donde aplica registro) | `auth/login`, `auth/me`, `auth/refresh`, `auth/logout`, `auth/forgot-password`, `auth/reset-password`, `privacy/*` | `/login`, `/recuperar-contrasena`, `/restablecer-contrasena`, `/app`, `/app/perfil`; `PrivacyGate` en aplicación autenticada |
| RF2 | `POST .../access-events/scan` responde **201** ante credencial y método válidos; **400**/**403**/**404** según DTO, rol o credencial; un segundo escaneo equivalente en ventana breve puede responder con indicación de duplicado sin crear evento repetido (regla en servicio de acceso). Asignación NFC: `POST .../access-events/credentials/nfc` (roles administrativos). | `AccessModule` | `access-events/scan`, `access-events/my-qr`, `access-events/credentials/nfc`, consultas de credenciales y eventos | `/app/acceso/escaner` (`EscanerAccesoPage`) |
| RF3 | Creación y ciclo de solicitud bajo `.../circuit-requests` con **201** en creación válida; actualización de GPS, avance de padre, señal docente y cambios de estado según implementación; confirmación de entrega explícita. Reglas: una solicitud operacional abierta por estudiante y día; operador familiar es padre/tutor. Los avisos en bandeja asociados al flujo se materializan según la implementación del dominio de circuito (persistencia de notificaciones). | `CircuitModule`, `VehiclesModule`, `DepartureConsentModule` | `circuit-requests`, `circuit-requests/today`, `circuit-requests/:id/map`, `circuit-requests/:id/gps`, `circuit-requests/:id/parent-progress`, `circuit-requests/:id/status`, `circuit-requests/:id/confirm-delivered`, `departure-consent/*` según dominio | `/app/circuito` (`CircuitPadrePage`), `/app/circuito/hoy` (`CircuitTodayPage`), `/app/circuito/:id` (`CircuitDetailPage`) |
| RF4 | Operaciones CRUD y consultas institucionales bajo `school/*` y `schools/*` retornan **200**/**201** según caso; **403** ante cruces de institución o rol. Importaciones y cargas acotadas a roles autorizados; entrega controlada de archivos con `files/*` cuando aplique. | `SchoolModule`, `SchoolsModule`, `SettingsModule`, `UploadsModule`, `FilesModule` | `school/*`, `schools/*`, `settings/*`, `uploads/*`, `files/*` | `/app/gestion-escolar`, `/app/escuelas`, `/app/institucion`, `/app/importaciones` |
| RF5 | Registro y consultas de asistencia, actividades y calificaciones con respuestas coherentes (**200**/**201**); boletines y documentos bajo rutas académicas; periodos cerrados aplican reglas de negocio (**400** cuando corresponda). | `AttendanceModule`, `ClassAttendanceModule`, `ActivitiesModule`, `AcademicPeriodsModule`, `ReportCardsModule`, `DocumentsModule`, `SchedulesModule`, `ClassSessionsModule`, `SchoolCalendarModule`, `ExportsModule` | `attendance/*`, `class-attendance/*`, `activities/*`, `academic-periods/*`, `report-cards/*`, `documents/*`, `schedules/*`, `class-sessions/*`, `calendar/*` | `/app/horario`, `/app/modulos/academico`, `/app/modulos/calificaciones-docente`, `/app/modulos/mis-calificaciones`, `/app/modulos/boletines`, `/app/modulos/periodos-academicos` |
| RF6 | Creación y consulta de deudas y registros de pago; carga de comprobante con **201**/**200** según endpoint; verificación o rechazo por personal autorizado; archivos sensibles vía `files/*` autenticado. Sin integración de pasarela automática. | `PaymentsModule`, `UploadsModule`, `FilesModule` | `payments/*`, `uploads/*`, `files/*` | `/app/modulos/finanzas` (`FinanzasPage`, herramientas de personal) |
| RF7 | Publicación y consulta de avisos; bandeja de notificaciones; registro de *token* FCM; flujos de **reportes administrativos** bajo `notifications/admin-reports/*` (roles según Anexo 08); correo transaccional desde dominios que consumen `MailModule` cuando está configurado. | `NoticesModule`, `MailModule` | `notices`, `notifications/*`, `notifications/admin-reports/*`, registro FCM | `/app/modulos/comunicacion`, componentes de avisos en `/app` |
| RF8 | Indicadores en `dashboard/*` y `dashboards/*`; reportes y exportaciones (`reports/*`, `exports/*`) con tipos MIME documentados; **403** ante rol insuficiente. | `DashboardModule`, `ReportsModule`, `ExportsModule` | `dashboard/*`, `dashboards/*`, `reports/*`, `exports/*` | `/app` (`AppHomePage`, paneles por rol), secciones de administración según navegación |

**Contratos de error generales (verificación):** **400** datos o estado inválido; **401** no autenticado o sesión inválida; **403** permisos insuficientes; **404** recurso ausente; **429** límite de peticiones.

---

## 6. Fuera de alcance del MVP

- Aplicaciones móviles nativas Android/iOS.
- Pasarela de pagos automática.
- Reconocimiento facial.
- Soporte multiidioma.
- Analítica avanzada con inteligencia artificial.

---

## 7. Reglas de negocio prioritarias

| Área | Regla |
| --- | --- |
| Autenticación | Un usuario inactivo no debe operar el sistema aunque conserve un *token* emitido previamente. |
| Autenticación | Tras un umbral de intentos fallidos de inicio de sesión, la cuenta puede quedar temporalmente bloqueada; la ventana y el umbral son los definidos en implementación (*lockout* en servicio de autenticación). |
| Autenticación | La renovación de sesión (`refresh`) mantiene una política de **un *refresh* activo por usuario** con rotación al renovar, simplificando revocación y coherencia de sesión en el MVP. |
| Multiinstitución | Los usuarios no globales solo pueden operar datos de su escuela, grupo, hijo o asignación. |
| Acceso (QR/NFC) | Un segundo registro de escaneo equivalente dentro de una **ventana breve** (orden de diez segundos en la implementación actual) se trata como duplicado y no debe generar un nuevo evento de acceso idéntico. |
| Credenciales | Solo puede existir **una** credencial NFC activa por usuario; un UID NFC activo no puede reasignarse a otro usuario sin revocar la asignación previa. |
| Circuito | Un estudiante solo puede tener una solicitud operacional abierta por día. |
| Circuito | El padre o tutor solicitante es quien opera el avance familiar; el personal escolar opera la salida institucional. |
| Asistencia | Los días no lectivos bloquean registros ordinarios según calendario institucional. |
| Académico | Un periodo cerrado restringe registros académicos, salvo acciones autorizadas y auditadas. |
| Pagos | Un padre solo puede cargar comprobantes de deudas asociadas a sus hijos. |
| Archivos | Comprobantes, excusas y evidencias sensibles se sirven por endpoint autenticado, no como públicos. |
| Privacidad | La aceptación de políticas debe registrarse y consultarse por usuario. |

---

## 8. Criterios de priorización

La prioridad de implementación se define por impacto institucional, seguridad del estudiante, dependencia entre módulos y relación con el alcance aprobado. Autenticación, control de acceso, gestión escolar y circuito se consideran críticos porque soportan la operación básica del sistema. Pagos, avisos, reportes y paneles complementan la administración y generan valor operativo, pero dependen de que los datos base y permisos estén correctamente configurados.

---

## 9. Criterios de no ambigüedad

- RF3 se interpreta como recogida realizada por padres o tutores; no existe conductor institucional independiente ni flota administrada por la escuela en el sentido de la FTG.
- RF6 no incluye pasarela de pagos; el alcance se limita a deuda, comprobante y verificación manual.
- RNF6 se ajusta técnicamente a despliegue en nube (p. ej. Railway para API y base, alojamiento estático para el cliente), por compatibilidad con Node.js, PostgreSQL y volumen persistente para archivos.
- **RNF4:** Si la FTG o la propuesta histórica citan umbrales fijos (p. ej. dos segundos), su cumplimiento **no se asume** sin medición: criterios, entorno y resultados se acreditan en el **Anexo 10** (o instrumento equivalente).
- Las métricas de rendimiento y usabilidad se fundamentan con evidencia en el **Anexo 10**; el plan de medición pertinente forma parte de ese anexo o del instrumento que lo sustituya.
- **Privacidad y normativa de datos personales:** el fundamento legal y la redacción del aviso de privacidad presentados al usuario deben alinearse con la **LFPDPPP** y normativa conexa en México, con el **responsable del tratamiento** y las **finalidades** definidos por la institución cliente de AlfaNetworks (el software provee mecanismos técnicos de aceptación y auditoría; no sustituye el dictamen jurídico). Los flujos técnicos de consentimiento y registro se describen en el **Anexo 03** (§4, §12.5) y en las reglas de este anexo (§7).

---

## 10. Relación con otros anexos del TDG

| Anexo | Contenido que sustenta este documento |
| --- | --- |
| 00 | Matriz de trazabilidad RF/RNF frente a implementación, alcance ampliado (§2.1) y pruebas. |
| 02 | Actas de reunión con AlfaNetworks (constancia de acuerdos funcionales y técnicos). |
| 03 | Documento de arquitectura: vistas lógica y de despliegue, lista de *bounded contexts* en `AppModule`, persistencia, seguridad, integraciones, riesgos mitigados (§10) y limitaciones residuales (§12). |
| 04 | Modelo entidad–relación: agrupación por dominio, relaciones clave, observaciones sobre despliegue, inventario **§8** (49 tablas ↔ entidad TypeORM) y listado **§9**. |
| 05 | Diagramas UML (actores, casos de uso por RF1–RF8, secuencia del circuito RF3, clases de contexto NestJS) y trazabilidad con pruebas E2E (**§8**). |
| 06 | Prototipos UI/UX: criterios, inventario de pantallas (**§3**), rutas y `RoleGate` (**§9–§10**), figuras y evaluación (**§4–§7**). |
| 07 | Manual técnico: requisitos, instalación API/cliente, base de datos, despliegue, variables críticas, *release*, incidentes, documentación en repo (**§12**) y **líneas de mejora** (**§13**). |
| 08 | Documentación API: resumen por dominio, seguridad, errores HTTP, RF (**§7**), catálogo **241** rutas (**§10**), Swagger `/docs` como fuente viva, **líneas de mejora contractuales y documentales** (**§12**) y relación con otros anexos (**§13**). |
| 09 | Manual de usuario: acceso, funciones por rol (**§4–§8**), flujos (**§10–§12**), situaciones frecuentes (**§13**), capturas (**§14**), rutas UI (**§15**), **líneas de mejora** (**§16** con **§16.1–§16.10**). |
| 10 | Informe de pruebas y métricas: estrategia (**§4**), E2E (**§8**), matriz RF (**§9**), entrega (**§10–§11**), CI (**§12**), mejoras (**§13**), patrones HTTP E2E (**§14**). |

---

*Fin del anexo 01 — Documento de requerimientos.*
