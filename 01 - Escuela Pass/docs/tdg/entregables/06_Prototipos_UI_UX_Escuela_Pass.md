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
