# ESCUELA PASS — Administración y seguridad escolar

## 06. Prototipos UI/UX Escuela Pass

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
**Tipo de documento:** Prototipos e inventario de pantallas  
**Versión:** 1.0 documental  

---

## 1. Propósito

**Nota de acrónimos del anexo.** **UI** (User Interface), **UX** (User Experience), **SPA** (Single-Page Application), **WCAG** (Web Content Accessibility Guidelines), **CSS** (Cascading Style Sheets), **DOM** (Document Object Model), **SUS** (System Usability Scale).

Este anexo describe los criterios de interfaz, el inventario de pantallas implementadas en el cliente React (React Team, s. f.) con Vite (Vite Team, s. f.) y el encaminamiento declarado en código. Los criterios UX adoptados se inspiran en las heurísticas de usabilidad clásicas (Nielsen, 1994), los principios de diseño centrado en el usuario (Norman, 2013), las pautas de accesibilidad WCAG 2.2 (W3C, 2023) y el enfoque pragmático de simplicidad propuesto por Krug (2014). La medición de usabilidad planificada se apoya en la SUS (Brooke, 1996) y sus benchmarks contemporáneos (Lewis & Sauro, 2018). Complementa los requerimientos del **Anexo 01**, la arquitectura del **Anexo 03**, los diagramas del **Anexo 05**, los contratos HTTP del **Anexo 08**, el **manual de usuario** del **Anexo 09** y el **informe de pruebas y métricas** del **Anexo 10**.

---

## 2. Criterios de diseño

La interfaz se implementa como **SPA** *responsive*, priorizando **móvil** para padres y tutores y **escritorio** para administración y docentes cuando el flujo lo favorece. Se prioriza **navegación por rol**, formularios comprensibles, **retroalimentación** ante errores y carga, y **consistencia** de componentes dentro del *shell* (`AppShell`, Tailwind).

---

## 3. Inventario de pantallas

| Dominio | Pantallas / flujo | Evidencia en frontend |
| --- | --- | --- |
| Autenticación | Inicio de sesión, recuperación y restablecimiento de contraseña | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` |
| Inicio por rol | Tablero y módulos según contexto | `AppHomePage`, `HomePage`, `navConfig` |
| Acceso físico | Escáner QR/NFC y resultado de lectura | `EscanerAccesoPage`, flujos con modales de resultado |
| Circuito (padre/tutor) | Crear solicitud, seguimiento, mapa informativo | `CircuitPadrePage`; mapa vía `ParentTrackingMap` en flujos de detalle |
| Circuito (personal) | Solicitudes del día, detalle, transiciones | `CircuitTodayPage`, `CircuitDetailPage` |
| Gestión escolar | Nómina, escuelas (plataforma), importación | `SchoolRosterPage`, `SchoolsAdminPage`, `ImportExportPage` |
| Académico | Periodos, calificaciones, boletines, horarios | `PeriodosAcademicosPage`, `CalificacionesDocentePage`, `MisCalificacionesPage`, `BoletinesPage`, `ScheduleHubPage` |
| Finanzas | Cartera, comprobantes y herramientas según rol | `FinanzasPage`, `FinanzasStaffTools` |
| Comunicación | Avisos y notificaciones; registro FCM | `ComunicacionPage`, `NotificationsBadge`, `FcmBootstrap` |
| Agenda | Visitas externas y reuniones | `VisitasPage`, `ReunionesPage` |
| Institución y perfil | Datos institucionales, perfil y credencial | `InstitutionPage`, `PerfilPage` |
| Administración y anotaciones | Módulos operativos de apoyo | `AdministracionPage`, `AnotacionesDocentePage`, `AcademicoPage` |

---

## 4. Prototipos principales por rol y flujo

*[Figura 1. Página de inicio de sesión y recuperación de contraseña Escuela Pass. Recomendado: Figma con Figma AI, o captura del cliente en ejecución con datos sintéticos.]*

*[Figura 2. Tablero del Administrador de plataforma con resumen multi-institución. Recomendado: Figma con Figma AI o captura del cliente en ejecución.]*

*[Figura 3. Tablero del Personal administrativo con accesos a nómina, finanzas, calendario y reportes. Recomendado: Figma con Figma AI o captura del cliente en ejecución.]*

*[Figura 4. Tablero del Docente con asistencia, actividades y calificaciones. Recomendado: Figma con Figma AI o captura del cliente en ejecución.]*

*[Figura 5. Vista del Padre o tutor con circuito de recogida y consultas académicas y financieras de los hijos. Recomendado: Figma con Figma AI o captura del cliente en ejecución.]*

*[Figura 6. Vista del Alumno con horario, calificaciones, boletines y credencial QR personal. Recomendado: Figma con Figma AI o captura del cliente en ejecución.]*

*[Figura 7. Escáner de credenciales QR y NFC en el navegador con retroalimentación de lectura. Recomendado: captura del cliente en ejecución con dispositivo móvil.]*

*[Figura 8. Mapa del circuito de recogida con indicador de proximidad al plantel apoyado en Mapbox. Recomendado: captura del cliente en ejecución sobre dispositivo móvil con datos sintéticos.]*

---

## 5. Evidencia gráfica (Figma o capturas)

Las figuras de la **sección 4** pueden sustentarse con **capturas del frontend en ejecución** o con **tableros en Figma** derivados de esas pantallas. Conviene conservar la misma nomenclatura de rutas y roles que en las secciones 9 y 10 para que el texto del TDG y el material gráfico coincidan en la documentación de sustentación.

---

## 6. Capturas sugeridas para el anexo maquetado

| Pantalla | Contenido esperado | Propósito |
| --- | --- | --- |
| Login | Flujo de acceso e identidad visual | Evidenciar RF1 y primera impresión de marca |
| Inicio por rol | Panel según rol autenticado | Mostrar navegación contextual |
| Perfil | Perfil de usuario y credencial QR | Evidenciar identidad y despliegue de QR |
| Circuito padre (móvil) | Solicitud y seguimiento RF3 | Enfasis en uso móvil del circuito familiar |
| Circuito del día (staff) | Lista y operación institucional | Evidenciar operación diaria del personal |
| Escáner | Lectura QR/NFC | Evidenciar RF2 |
| Gestión escolar | Grupos, estudiantes, docentes y padres | Evidenciar RF4 |
| Calificaciones (docente) | Actividades y registros de notas | Evidenciar RF5 |
| Mis calificaciones | Consulta padre/alumno | Evidenciar consulta autorizada |
| Finanzas | Deudas, comprobantes, herramientas staff | Evidenciar RF6 |
| Boletines | Informes académicos consolidados | Evidenciar reportes académicos |

---

## 7. Criterios de evaluación UX

- **Claridad:** el usuario identifica la acción siguiente sin ambigüedad apreciable.
- **Consistencia:** botones, tarjetas, formularios y modales mantienen patrones visuales y de redacción afines.
- **Accesibilidad básica:** contraste legible, mensajes de error comprensibles y estados de carga visibles.
- **Responsividad:** flujos críticos (padre/tutor, escáner) utilizables en **móvil** y **escritorio** según el caso de uso.
- **Seguridad percibida:** acciones sensibles con confirmación o retroalimentación explícita cuando el producto lo implementa.

---

## 8. Prompt para prototipo en Figma o diagrama auxiliar

Diseñar un conjunto de pantallas UI/UX para Escuela Pass con estilo institucional moderno, *responsive* y sobrio. Incluir: **login**, **panel por rol**, **perfil con QR**, **circuito de recogida móvil** (padre/tutor), **circuito del día** (personal), **escáner QR/NFC**, **gestión escolar**, **calificaciones docente**, **consulta de calificaciones** (padre/alumno), **finanzas con comprobantes** y **boletines**. Usar jerarquía clara, navegación lateral en escritorio y navegación adaptada en móvil, tarjetas de resumen, formularios ordenados y estados de carga y error. **No** inventar funciones que no existan en el repositorio; alinearse a rutas y módulos reales (`navConfig`, páginas citadas en la sección 3).

---

## 9. Rutas declaradas en `frontend/src/App.tsx`

Las rutas **públicas** (sin *shell* autenticado) incluyen: `/`, `/login`, `/recuperar-contrasena`, `/restablecer-contrasena`. La ruta `/panel` **redirige** a `/app`. La ruta comodín `*` muestra página de recurso no encontrado.

Las rutas bajo **`/app`** exigen usuario autenticado (`ProtectedRoute` más *shell* con `PrivacyGate`). Relativo al prefijo `/app`:

| Ruta relativa | Comportamiento o página principal |
| --- | --- |
| *(índice)* | `AppHomePage` |
| `perfil` | `PerfilPage` |
| `horario` | `ScheduleHubPage` |
| `institucion` | `InstitutionPage` |
| `gestion-escolar` | `SchoolRosterPage` |
| `escuelas` | `SchoolsAdminPage` |
| `modulos` | Redirección a `/app` |
| `modulos/comunicacion` | `ComunicacionPage` |
| `modulos/reuniones` | `ReunionesPage` |
| `modulos/visitas-externas` | `VisitasPage` |
| `modulos/anotaciones-docente` | `AnotacionesDocentePage` |
| `modulos/finanzas` | `FinanzasPage` |
| `modulos/academico` | `AcademicoPage` |
| `modulos/calificaciones-docente` | `CalificacionesDocentePage` |
| `modulos/mis-calificaciones` | `MisCalificacionesPage` |
| `modulos/boletines` | `BoletinesPage` |
| `modulos/periodos-academicos` | `PeriodosAcademicosPage` |
| `modulos/administracion` | `AdministracionPage` |
| `modulos/herramientas` | Redirección a `/app/perfil` |
| `importaciones` | `ImportExportPage` |
| `acceso/escaner` | `EscanerAccesoPage` |
| `circuito/hoy` | `CircuitTodayPage` |
| `circuito/:id` | `CircuitDetailPage` |
| `circuito` | `CircuitPadrePage` |

*Nota:* la **autorización fina** de cada operación sigue dependiendo de la API y de la lógica interna de cada página; esta tabla describe **solo** el encaminamiento y los componentes de página asociados en el cliente.

---

## 10. Restricción por rol (`RoleGate` en `App.tsx`)

Solo las rutas siguientes declaran explícitamente `RoleGate` con lista `allow`. El resto de rutas autenticadas bajo `/app` no tienen esta envoltura en `App.tsx` (pero siguen exigiendo sesión válida).

| Ruta absoluta | Roles permitidos |
| --- | --- |
| `/app/horario` | ALUMNO, DOCENTE, ADMIN, ADMINISTRATIVO |
| `/app/gestion-escolar` | ADMIN, ADMINISTRATIVO |
| `/app/escuelas` | ADMIN |
| `/app/modulos/anotaciones-docente` | ADMIN, ADMINISTRATIVO, DOCENTE |
| `/app/modulos/calificaciones-docente` | ADMIN, ADMINISTRATIVO, DOCENTE |
| `/app/modulos/mis-calificaciones` | ALUMNO, PADRE, ADMIN, ADMINISTRATIVO |
| `/app/modulos/boletines` | ADMIN, ADMINISTRATIVO, DOCENTE, ALUMNO, PADRE |
| `/app/modulos/periodos-academicos` | ADMIN, ADMINISTRATIVO |
| `/app/modulos/administracion` | ADMIN, ADMINISTRATIVO |
| `/app/importaciones` | ADMIN, ADMINISTRATIVO, DOCENTE |
| `/app/acceso/escaner` | ADMIN, ADMINISTRATIVO, DOCENTE |
| `/app/circuito/hoy` | DOCENTE, ADMIN, ADMINISTRATIVO |
| `/app/circuito/:id` | PADRE, DOCENTE, ADMIN, ADMINISTRATIVO |
| `/app/circuito` | PADRE, ADMIN, ADMINISTRATIVO |

---

## 11. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—implementación—evidencia; columna de pantallas y rutas. |
| 01 | RF1–RF8 y actores que las pantallas materializan. |
| 03 | Vista lógica, *shell* y despliegue del cliente frente a la API. |
| 04 | Datos mostrados en formularios (entidades y relaciones). |
| 05 | Casos de uso y secuencia que estas pantallas instancian. |
| 07 | Puesta en marcha del stack para capturas y pruebas de interfaz. |
| 08 | Catálogo REST consumido por cada vista (**Anexo 08**, §3 y §10). |
| 09 | Manual de usuario por rol, flujos y rutas **`/app/...`** (**Anexo 09**, §10–§15, mejoras **§16**). |
| 10 | Informe de pruebas y métricas; evidencia **RNF4/RNF5** (**Anexo 10**, **§6**, **§10**, **§13**). |

---

*Fin del anexo 06 — Prototipos UI/UX.*
