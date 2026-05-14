# 06. Prototipos UI UX Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Prototipos e inventario de pantallas  
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


## 1. Criterios De Diseño

La interfaz se diseña como SPA responsive, priorizando uso móvil para padres/tutores y escritorio
para administración. Se busca navegación por rol, formularios claros, retroalimentación inmediata
y consistencia visual.

## 2. Inventario De Pantallas

| Dominio | Pantallas / flujo | Evidencia frontend |
| --- | --- | --- |
| Autenticación | Login, recuperación y reset | LoginPage, ForgotPasswordPage, ResetPasswordPage |
| Inicio por rol | Dashboard y navegación adaptada | AppHomePage, HomePage, navConfig |
| Acceso | Escáner QR/NFC y resultado | EscanerAccesoPage, QrScanResultModal |
| Circuito padre | Crear solicitud, seguimiento, mapa | CircuitPadrePage, ParentTrackingMap |
| Circuito staff | Solicitudes de hoy, detalle, transiciones | CircuitTodayPage, CircuitDetailPage |
| Gestión escolar | Roster, escuelas, importación | SchoolRosterPage, SchoolsAdminPage, ImportExportPage |
| Académico | Periodos, calificaciones, boletines, horarios | PeriodosAcademicosPage, CalificacionesDocentePage, BoletinesPage, ScheduleHubPage |
| Finanzas | Conceptos, deudas, comprobantes | FinanzasStaffTools |
| Comunicación | Avisos, notificaciones, FCM | NotificationsBadge, FcmBootstrap |
| Agenda | Visitas y reuniones | VisitasPage, ReunionesPage |

## 3. Prototipos Principales

[Figura 1. Prototipo login Escuela Pass centrado]

[Figura 2. Prototipo dashboard administrativo centrado]

[Figura 3. Prototipo circuito padre móvil centrado]

[Figura 4. Prototipo escáner QR/NFC centrado]

[Figura 5. Prototipo gestión académica y boletines centrado]

## 4. Nota Sobre Figma

El entregable propone que las pantallas finales se documenten en Figma o en capturas verificables
del frontend. Si se requiere publicación en un archivo Figma institucional, debe generarse desde
las pantallas reales y validarse visualmente antes de anexarlo. Mientras no exista ese enlace
verificado, se conservan placeholders centrados para no simular evidencia gráfica inexistente.

## 5. Capturas Requeridas Para Anexo

| Pantalla | Placeholder sugerido | Propósito |
| --- | --- | --- |
| Login | `[UI/UX del inicio de sesión]` | Evidenciar acceso inicial y marca visual. |
| Inicio por rol | `[UI/UX del panel inicial por rol]` | Mostrar navegación contextual. |
| Perfil | `[UI/UX del perfil del usuario y QR]` | Evidenciar identidad y credencial QR. |
| Circuito padre móvil | `[UI/UX del circuito de recogida para padre]` | Mostrar enfoque móvil del RF3. |
| Circuito del día staff | `[UI/UX del circuito del día para personal escolar]` | Mostrar operación institucional. |
| Escáner QR/NFC | `[UI/UX del escáner de acceso]` | Evidenciar control de accesos. |
| Gestión escolar | `[UI/UX de grupos, estudiantes, docentes y padres]` | Evidenciar RF4. |
| Calificaciones docente | `[UI/UX de actividades y notas del docente]` | Evidenciar RF5. |
| Mis calificaciones | `[UI/UX de consulta académica padre/alumno]` | Evidenciar consulta autorizada. |
| Finanzas | `[UI/UX de pagos y comprobantes]` | Evidenciar RF6. |
| Boletines | `[UI/UX de boletines académicos]` | Evidenciar reportes académicos. |

## 6. Criterios De Evaluación UX

- Claridad: el usuario debe identificar fácilmente qué acción realizar.
- Consistencia: botones, tarjetas, formularios y modales deben mantener lenguaje visual uniforme.
- Accesibilidad básica: contraste suficiente, mensajes de error y estados de carga.
- Responsividad: pantallas críticas deben funcionar en escritorio y móvil.
- Seguridad percibida: operaciones sensibles deben confirmar acciones y mostrar mensajes claros.

## 7. Prompt Para Prototipo En Figma O Lucidchart

Diseñar un set de pantallas UI/UX para Escuela Pass con estilo institucional moderno, responsive y
sobrio. Incluir: login, dashboard por rol, perfil con QR, circuito de recogida móvil para padre,
circuito del día para staff, escáner QR/NFC, gestión escolar, calificaciones docente, consulta de
calificaciones padre/alumno, finanzas con comprobantes y boletines. Usar jerarquía clara, navegación
lateral en escritorio, navegación adaptada a móvil, tarjetas de resumen, formularios limpios y estados
de carga/error. No inventar funciones fuera del repositorio.
