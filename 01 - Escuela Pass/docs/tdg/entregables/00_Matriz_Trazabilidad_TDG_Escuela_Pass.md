# 00. Matriz De Trazabilidad TDG Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Matriz de control  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Propósito

Esta matriz controla la relación entre la propuesta aprobada, el código implementado, las rutas
de API, las pantallas del frontend y los documentos entregables. Su función es evitar que el
trabajo de grado se convierta en una descripción improvisada del código y garantizar que cada
objetivo pueda evidenciarse con artefactos verificables.

## 2. Matriz RF/RNF ↔ Código ↔ Evidencia

| Código | Requerimiento | Módulos / evidencia | Rutas API | Pantallas | Estado |
| --- | --- | --- | --- | --- | --- |
| RF1 | Autenticación con roles JWT | auth, privacy, audit | /auth/login, /auth/me, /auth/refresh | LoginPage, AuthProvider, ProtectedRoute | Cumplido |
| RF2 | Control de accesos QR/NFC | access | /access-events/scan, /access-events/my-qr | EscanerAccesoPage, QrScanResultModal | Cumplido |
| RF3 | Circuito de recogida con GPS | circuit, vehicles, departure-consent, fcm | /circuit-requests, /circuit-requests/:id/gps, /circuit-requests/:id/status | CircuitPadrePage, CircuitTodayPage, CircuitDetailPage, ParentTrackingMap | Cumplido con ajuste: conductor = padre/tutor |
| RF4 | Gestión escolar | school, schools, uploads, settings | /school/*, /schools/*, /uploads/* | SchoolRosterPage, SchoolsAdminPage, InstitutionPage | Ampliado |
| RF5 | Asistencia y calificaciones | attendance, activities, academic-periods, report-cards, documents, exports | /attendance/*, /activities/:id/grades, /report-cards/* | CalificacionesDocentePage, MisCalificacionesPage, BoletinesPage | Ampliado |
| RF6 | Pagos y colegiaturas | payments, uploads, reports | /payments/concepts, /payments/debts, /payments/debts/:id/voucher/file | FinanzasStaffTools y vistas operativas | Cumplido sin pasarela automática |
| RF7 | Avisos y notificaciones | notices, notifications, fcm, mail | /notices, /notifications/me, /notifications/fcm/register | NotificationsBadge, FcmBootstrap | Cumplido |
| RF8 | Dashboard administrativo | dashboard, dashboards, reports, exports | /dashboard/summary, /dashboard/panel, /reports/*, /exports/* | AdminDashboardPanel, AppHomePage | Ampliado |
| RNF1 | NestJS y PostgreSQL | AppModule, TypeORM config, migrations | N/A | N/A | Cumplido |
| RNF2 | Diseño responsive | frontend React/Vite | N/A | AppShell, páginas por rol | Cumplido |
| RNF3 | Seguridad: bcrypt, JWT, validación, SQL seguro | auth, guards, ValidationPipe, TypeORM | N/A | N/A | Cumplido; HTTPS depende del despliegue |
| RNF4 | Operaciones principales menores a 2 s | reports, dashboard, indexes | N/A | N/A | A validar con métricas |
| RNF5 | Interfaz intuitiva | frontend | N/A | navegación por rol, formularios | A validar con usuarios |
| RNF6 | Hosting proporcionado | Railway/Vercel | N/A | N/A | Ajustado frente a cPanel propuesto |

## 3. Mapa A Objetivos Específicos

| Objetivo específico | Evidencia principal | Entregables relacionados |
| --- | --- | --- |
| Analizar requerimientos | RF/RNF, actores, actas y reglas de negocio | 01, 02, 00 |
| Diseñar arquitectura, BD e interfaces | Diagramas, ER, prototipos UI/UX | 03, 04, 05, 06 |
| Implementar backend | Módulos NestJS, TypeORM, Swagger, migraciones | 03, 07, 08 |
| Desarrollar frontend | React/Vite, rutas por rol, flujos móviles | 06, 09 |
| Validar funcionamiento | E2E, smoke, pruebas manuales y métricas | 10 |

## 4. Inconsistencias Justificadas

- La propuesta menciona Google Maps o Mapbox; la implementación adopta Mapbox y fallback Haversine.
- La propuesta menciona qrcode.js; la implementación usa `html5-qrcode` para escaneo y `qrcode.react` para generación visual.
- La propuesta menciona cPanel; el repo evidencia Railway para API y Vercel/hosting estático para frontend.
- El circuito vial no automatiza entregas por cercanía GPS; el mapa es informativo y las transiciones se registran por acciones explícitas.
- El alcance real incorporó módulos adicionales: multiinstitución, privacidad, auditoría, boletines, PDFs, visitas, reuniones, horarios y notas de atención.
