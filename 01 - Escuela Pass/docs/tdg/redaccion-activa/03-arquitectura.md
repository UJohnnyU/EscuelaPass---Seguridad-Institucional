# ESCUELA PASS — Administración y seguridad escolar

## 03. Documento de arquitectura Escuela Pass

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
**Tipo de documento:** Arquitectura de software  
**Versión:** 1.0 documental  

---

## 1. Visión arquitectónica

Escuela Pass es una aplicación web institucional de AlfaNetworks orientada a la administración y seguridad escolar. La solución combina una API NestJS con PostgreSQL, una SPA React/Vite, control de acceso por QR/NFC, circuito de recogida iniciado por padres o tutores, comunicación por avisos y notificaciones, gestión académica, pagos, reportes y despliegue cloud.

La interpretación oficial del RF3 es que los padres o tutores actúan como conductores del circuito de recogida desde la aplicación web móvil; no se trata de una flota independiente de vehículos escolares administrada por terceros. La geolocalización se usa como apoyo informativo para el mapa y ETA, y puede registrar automáticamente la llegada al radio del plantel; las autorizaciones institucionales y la confirmación final continúan siendo acciones explícitas.

La arquitectura sigue una separación cliente-servidor: una SPA React/Vite consume una API REST NestJS (JSON, cabecera `Authorization: Bearer`) bajo un prefijo global configurable (`API_PREFIX`, documentalmente `api/v1`). PostgreSQL concentra la persistencia, mientras FCM, SMTP, Mapbox y almacenamiento de archivos actúan como servicios complementarios.

## 2. Vista lógica

El backend registra los *bounded contexts* de dominio en `src/app.module.ts`, en este orden de importación: `HealthModule`, `MailModule`, `AuthModule`, `AccessModule`, `CircuitModule`, `ClassAttendanceModule`, `ClassSessionsModule`, `NoticesModule`, `PaymentsModule`, `AttendanceModule`, `ActivitiesModule`, `AttentionNotesModule`, `AcademicPeriodsModule`, `ReportCardsModule`, `AcademicSchedulerModule`, `ReportsModule`, `SchoolModule`, `ExportsModule`, `DashboardModule`, `SchedulesModule`, `SchoolCalendarModule`, `SettingsModule`, `VehiclesModule`, `DocumentsModule`, `AuditModule`, `PrivacyModule`, `SchoolsModule`, `UploadsModule`, `FilesModule`, `DepartureConsentModule`, `EventSchedulerModule`, `ExternalVisitsModule`.

Además, el módulo raíz configura de forma transversal `ConfigModule` (variables de entorno), `TypeOrmModule` (PostgreSQL), `ThrottlerModule` con `ThrottlerGuard` global (*rate limiting*) y `ScheduleModule` (tareas programadas en servidor).

**Módulos anidados (no listados como import directo en `AppModule` pero parte del árbol de la aplicación):** `MeetingsModule` se importa desde `DashboardModule`; `AcademicNotificationsModule` y `EventsCoreModule` aparecen como dependencias de módulos académicos, de eventos, visitas o reuniones según el grafo de importaciones del código fuente.

El frontend en `frontend/src` organiza páginas por rol y dominio: autenticación, inicio, escáner, circuito, gestión escolar, visitas, reuniones, boletines, calificaciones, periodos académicos, horarios, institución, perfil y panel administrativo.

[Figura 1. Arquitectura lógica y de contexto del sistema Escuela Pass]

## 3. Vista de despliegue

| Componente | Tecnología | Evidencia |
| --- | --- | --- |
| Cliente web | React 18 + Vite + Tailwind | `frontend/package.json`, `frontend/src` |
| API | NestJS 10 + TypeORM | `package.json`, `src/main.ts`, `src/app.module.ts` |
| Superficie HTTP | Prefijo REST acotado (`API_PREFIX`), `GET .../health` | `src/main.ts`, `HealthModule`; convención documental alineada al **Anexo 00** |
| Base de datos | PostgreSQL | `src/database/entities`, migraciones y scripts SQL del repositorio |
| Backend cloud | Railway | `railway.toml` |
| Frontend cloud | Vercel u hosting estático | `frontend/vercel.json` |
| Push | Firebase Cloud Messaging | `src/modules/fcm`, `POST api/v1/notifications/fcm/register` (prefijo global configurable) |
| Correo | SMTP / Nodemailer | `src/modules/mail`, recuperación de contraseña |
| Archivos | Volumen `UPLOADS_DIR` | `src/lib/uploads-path.ts`, ruta `/uploads` y módulos `uploads` / `files` |

[Figura 2. Vista de despliegue: Railway, PostgreSQL, API NestJS y cliente web estático]

## 4. Seguridad

- `helmet` para cabeceras HTTP.
- CORS parametrizado con `CORS_ORIGIN`.
- `ValidationPipe` global con *whitelist* y bloqueo de propiedades no permitidas.
- `ThrottlerGuard` global para límite de tasa de peticiones.
- Hash de contraseñas con bcrypt.
- JWT con roles y `schoolId` para filtrado multiinstitución.
- TypeORM reduce riesgo de inyección SQL en consultas parametrizadas.
- Los logos institucionales bajo `uploads/school-logos` pueden exponerse como estáticos públicos; el resto de archivos sensibles se entrega con autenticación vía `/files/...` (y rutas homólogas documentadas en el **Anexo 08**).

El almacenamiento de *tokens* en el cliente y el modelo de amenaza asociado se explicitan en la **sección 12.2**, sin contradecir las medidas anteriores.

## 5. Persistencia

La persistencia se modela con entidades TypeORM y migraciones versionadas. En tiempo de arranque, la aplicación también puede ejecutar un saneo idempotente del esquema (`ensureRuntimeSchema`) descrito en el código; la convivencia de ambos mecanismos y su interpretación como supuesto de despliegue se precisan en la **sección 12.1**. La base incluye usuarios, roles, escuelas, grupos, estudiantes, docentes, padres, asistencias, actividades, report cards, pagos, circuito, visitas, reuniones, notificaciones, privacidad y auditoría, entre otras entidades alineadas con el **Anexo 04**.

## 6. Integraciones externas

- **FCM:** envío de *push* web si hay token y credencial de cuenta de servicio.
- **Mapbox:** mapa y ETA del circuito; *fallback* por distancia Haversine si no hay token.
- **SMTP:** restablecimiento de contraseña y correos de agenda si se configura el host.
- **Uploads:** comprobantes, avatares, logos, evidencias y excusas en volumen persistente.

## 7. Decisiones y justificación

La propuesta contemplaba cPanel y Google Maps como alternativas. El repositorio evidencia Railway/Vercel y Mapbox. La decisión se justifica por despliegue cloud simple, variables de entorno, Postgres administrado, volumen persistente y facilidad de integración con Vite.

## 8. Representación gráfica de la arquitectura

Las figuras 1 y 2 complementan las secciones anteriores: la primera sintetiza la vista lógica y el flujo entre usuario, aplicación cliente, API, base de datos y servicios periféricos; la segunda, la distribución en infraestructura de despliegue (cliente estático, servicio de API, PostgreSQL y dependencias externas) coherente con la tabla de la sección 3.

## 9. Vista de módulos por dominio

| Dominio | Módulos (*responsabilidad resumida*) | Responsabilidad |
| --- | --- | --- |
| Identidad | `auth`, `privacy`, `audit` | Sesión, estado de cuenta, aceptación de políticas y trazabilidad. |
| Seguridad física | `access`, `circuit`, `vehicles`, `departure-consent` | Entrada/salida, QR/NFC, circuito de recogida y vehículos familiares. |
| Académico | `attendance`, `class-attendance`, `activities`, `academic-periods`, `report-cards`, `documents` | Asistencia, clases, notas, periodos, boletines y documentos PDF. |
| Gestión escolar | `school`, `schools`, `settings`, `class-sessions`, `schedules` | Escuelas, grupos, personas, horarios y configuración institucional. |
| Administración | `payments`, `reports`, `exports`, `dashboard` | Pagos, reportes, indicadores y exportables. |
| Comunicación | `notices` (incluye rutas de notificaciones), `meetings` (vía `dashboard`), `external-visits`, `attention-notes`, `mail`, FCM | Avisos, reuniones, visitas, anotaciones, correo y *push*. |

## 10. Riesgos arquitectónicos y mitigaciones

| Riesgo | Mitigación implementada |
| --- | --- |
| Acceso indebido a archivos sensibles | Endpoint `/files` con autenticación, validación de *bucket*, nombre seguro y reglas por relación. |
| Operación multiinstitución incorrecta | Uso de `schoolId`, roles y consultas restringidas por escuela o relación. |
| Token válido de usuario inactivo | `JwtStrategy` consulta estado del usuario en cada petición protegida. |
| Datos inválidos en DTO | `ValidationPipe` global y DTOs con `class-validator`. |
| Exposición de Swagger en producción | OpenAPI en `/docs` deshabilitada por defecto en producción salvo `ENABLE_SWAGGER=true` (comentarios en código sugieren además protección básica opcional con `SWAGGER_USER` / `SWAGGER_PASSWORD`). |
| Falta de persistencia de uploads en cloud | Uso de `UPLOADS_DIR` y volumen persistente documentado para Railway. |

---

## 11. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—implementación—evidencia; referencia explícita a módulos y rutas. |
| 01 | Requerimientos RF/RNF y §5.1 con criterios medibles alineados a `AppModule`. |
| 02 | Actas con AlfaNetworks que fijan interpretación funcional (p. ej. circuito familiar). |
| 04 | Modelo entidad–relación; **49** entidades TypeORM en `buildTypeOrmConfig()`; inventario **§8** y despliegue **§9**. |
| 05 | Diagramas UML (casos de uso, secuencia, clases de contexto), figuras Mermaid/Lucidchart y lista de escenarios E2E en `test/app.e2e-spec.ts`. |
| 06 | Inventario de pantallas, rutas en `frontend/src/App.tsx`, prototipos y criterios UX (**Anexo 06**). |
| 07 | Manual técnico: instalación, variables, migraciones, Railway, mantenimiento y **§13** (mejoras y auditoría). |
| 08 | Catálogo REST alineado a controladores (**Anexo 08**); OpenAPI en `/docs`. |
| 09 | Manual de usuario: operación del cliente frente a la API documentada. |
| 10 | Informe de pruebas y métricas (**Anexo 10**): E2E, CI y registro de **RNF4/RNF5** (**§4**, **§6–§8**, **§13**). |

Las **limitaciones residuales** y las **líneas de mejora** profesional vinculadas a esta vista, complementarias a la enumeración RF/RNF del **Anexo 01**, se desarrollan en la **sección 12**.

---

## 12. Limitaciones residuales, supuestos y líneas de mejora

Este apartado acota la lectura del producto en conjunto con la matriz del **Anexo 00**: no amplía la FTG ni sustituye los requerimientos del **Anexo 01**; registra supuestos técnicos, riesgos residuales admitidos y trabajo futuro profesional, enlazado con los **Anexos 04** (datos), **08** (contratos HTTP) y **10** (pruebas y mediciones).

### 12.1 Persistencia y evolución del esquema

La **fuente de verificación versionada** del modelo relacional es la cadena de migraciones TypeORM bajo `src/database/migrations/`. Paralelamente, el arranque puede aplicar `ensureRuntimeSchema` (sentencias SQL idempotentes) para alinear entornos donde la CLI de migraciones no corre fuera del proceso de despliegue. La correspondencia entidad–tabla y reglas de integridad se documentan en el **Anexo 04** (véase allí §1, §4 y §8). En evoluciones del producto, la cadena de migraciones y el saneo de esquema deben mantenerse **coherentes entre sí** y reflejados en la documentación de datos, evitando divergencias no explícitas. La **política operativa** (“migración + entidad + actualización del Anexo 04”, usos de SQL v4 y límites de `ensureRuntimeSchema`) está tabulada en **`docs/technical-setup.md`** (*Política de cambios de esquema*); el **Anexo 07**, §13.1, contextualiza riesgos y prioridades para la evaluación del trabajo.

### 12.2 Cliente web y sesión JWT

El *frontend* conserva *tokens* de acceso y de renovación en **almacenamiento del navegador** (`localStorage`, véase `frontend/src/lib/storage.ts`), coherente con una SPA que envía `Authorization: Bearer`. Eso implica una superficie de riesgo ante scripts de terceros mayor que la de cookies `httpOnly`. Las mitigaciones vigentes incluyen validación y autorización en servidor, HTTPS en producción, *rate limiting* y controles de archivos; una **línea de mejora** documental y técnica es evaluar *Backend-for-Frontend*, cookies con políticas `SameSite` acordes o endurecimiento adicional (p. ej. política de contenidos) según el marco de amenazas institucional.

### 12.3 Integraciones opcionales

**FCM**, **SMTP** y **Mapbox** dependen de variables y credenciales. Si faltan, el sistema preserva el núcleo institucional con **degradación controlada** (sin *push*, sin correo transaccional o con mapa/ETA simplificados mediante *fallback* ya previsto en dominio, según configuración). Esto es coherente con los criterios del **Anexo 01** para RF1, RF3 y RF7.

### 12.4 Pruebas automatizadas

La verificación reproducible en repositorio combina pruebas **e2e** en `test/` (p. ej. `app.e2e-spec.ts`, `phase7-closure.e2e-spec.ts`, `auth-throttle-ip.e2e-spec.ts`) y scripts de *smoke*; la cobertura **unitaria** sobre servicios aislados es acotada. La **matriz de flujos** (**Anexo 00**, §5) y el **plan de validación** (**Anexo 10**) declaran la estrategia de pruebas y los riesgos residuales asociados a esa estrategia.

### 12.5 Privacidad y marco normativo

Los flujos de aceptación de políticas, registro de versiones y auditoría asociada están implementados. El **texto jurídico** del aviso y su vinculación al ordenamiento aplicable al caso de estudio (**México**: **LFPDPPP** y normativa conexa; lineamientos del **INAI** cuando proceda) deben ser coherentes en el cuerpo principal del TDG o en anexo de tratamiento, y **no** sustituirse por referencias genéricas incrustadas sólo en comentarios de código. Las reglas de negocio de privacidad del **Anexo 01** (§7) permanecen como referencia funcional.

### 12.6 Mantenibilidad del código de dominio

Algunos servicios concentran reglas de negocio y consultas SQL explícitas extensas. Una línea de mejora profesional es extraer *repositories*, reducir duplicación y acotar archivos de servicio **sin alterar** las rutas públicas documentadas en el **Anexo 08**.

---

*Fin del anexo 03 — Documento de arquitectura.*
