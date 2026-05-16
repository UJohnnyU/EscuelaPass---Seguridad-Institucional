# ESCUELA PASS — Administración y seguridad escolar

## 09. Manual de usuario Escuela Pass

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
**Tipo de documento:** Guía de operación por perfil  
**Versión:** 1.0 documental  

---

## 1. Propósito

**Nota de acrónimos del anexo.** **UI** (User Interface), **UX** (User Experience), **OTP** (One-Time Password), **RSVP** (*Répondez s'il vous plaît*, confirmación de asistencia), **FCM** (Firebase Cloud Messaging), **QR** (Quick Response), **NFC** (Near Field Communication), **SUS** (System Usability Scale), **WCAG** (Web Content Accessibility Guidelines), **PDF** (Portable Document Format), **XLSX** (Office Open XML Spreadsheet).

Este anexo orienta a los usuarios finales —personal de plataforma, administración escolar, docentes, familias y estudiantes— en el uso de la aplicación web Escuela Pass: acceso, módulos visibles por rol, flujos habituales y respuesta ante mensajes frecuentes. Los criterios de redacción siguen las heurísticas de usabilidad de Nielsen (1994), los principios de diseño centrado en el usuario (Norman, 2013) y la sensibilidad de accesibilidad de la WCAG 2.2 (W3C, 2023). La medición de usabilidad planificada se apoya en la SUS (Brooke, 1996; Lewis & Sauro, 2018). Complementa los requerimientos del **Anexo 01**, el inventario de pantallas del **Anexo 06**, la instalación y variables del **Anexo 07** y los contratos REST del **Anexo 08**. La navegación efectiva del menú lateral procede de `frontend/src/navigation/navConfig.ts` y el árbol de rutas de `frontend/src/App.tsx`; ante duda sobre disponibilidad de una pantalla, prevalece el comportamiento del despliegue (incluido `RoleGate`). La sección 16 consolida líneas de mejora profesionales y académicas vinculadas al manual, a la interfaz y a la trazabilidad RF/RNF.

---

## 2. Marco documental y criterio de redacción

La presentación del trabajo de grado sigue el **manual de estilo APIT** (p. ej. Times New Roman 12 pt, márgenes estándar, títulos numerados, citación autor-fecha y referencias **APA 7** donde aplique) y la **plantilla TDG** institucional. Los alcances funcionales se alinean a la **propuesta FTG** (RF1–RF8, RNF1–RNF6). Esta guía fue redactada en estilo académico propio a partir de la propuesta, el **código fuente** y la documentación técnica del repositorio; material externo sirvió solo como referencia de estructura y nivel de detalle documental.

---

## 3. Acceso al sistema

El usuario ingresa desde un **navegador web** a la URL desplegada del cliente, abre **`/login`**, introduce **correo** y **contraseña** y accede al área autenticada bajo **`/app`**. Los módulos visibles dependen del **rol** y de la relación con la institución. Si olvidó la contraseña, puede usar **`/recuperar-contrasena`** y el flujo de **correo electrónico** cuando el servidor tenga **SMTP** configurado (**Anexo 07**). Tras autenticación, puede aplicarse el flujo de **privacidad** (`PrivacyGate`) hasta aceptar la política vigente.

**Rutas públicas de identidad:** `/`, `/login`, `/recuperar-contrasena`, `/restablecer-contrasena`. La ruta `/panel` redirige a `/app`.

---

## 4. Administrador de plataforma (`ADMIN`)

Perfil orientado a la **operación multi-escuela** cuando el usuario no está acotado a una sola institución en el modelo de datos (**Anexo 01**, **Anexo 04**).

- Gestionar **instituciones** y usuarios administrativos asociados: **`/app/escuelas`** (`SchoolsAdminPage`).
- Supervisar **configuración** y operación transversal coherente con el despliegue (variables y servicios opcionales: **Anexo 07**).
- Acceder a **auditoría** y herramientas ampliadas según lo expuesto en panel e informes cuando la implementación lo habilite (**API** en **Anexo 08**).
- Revisar **privacidad** y cumplimiento del flujo de consentimiento informado acorde al **Anexo 03**.

Entradas de menú típicas además de **Inicio** y **Mi perfil**: **Escuelas**, **Grupos y personas**, **Importar y exportar**, **Institución**, **Administración e informes**, **Circuito del día**, **Escáner de acceso**, módulos académicos y de comunicación según `navConfig`.

*Nota de interfaz:* la acción **Reportar problema** del *shell* se muestra a usuarios con rol distinto de `ADMIN` (`AppShell.tsx`); el administrador de plataforma canaliza incidencias por los módulos institucionales o la comunicación operativa.

---

## 5. Personal administrativo (`ADMINISTRATIVO`)

- **Nómina escolar:** grupos, materias, estudiantes, docentes y padres — **`/app/gestion-escolar`**.
- **Importación y exportación** masiva — **`/app/importaciones`**; revisar historial según pantalla.
- **Finanzas:** conceptos, deudas, revisión de comprobantes — **`/app/modulos/finanzas`**.
- **Calendario institucional, visitas y reuniones:** **`/app/modulos/visitas-externas`**, **`/app/modulos/reuniones`**, **`/app/modulos/periodos-academicos`**, **`/app/institucion`** según corresponda.
- **Circuito del día** y seguimiento operativo — **`/app/circuito/hoy`**, detalle **`/app/circuito/:id`**.
- **Panel e informes** — **`/app/modulos/administracion`**.
- **Comunicación, avisos y reportes administrativos** (RF7) — **`/app/modulos/comunicacion`**; según permisos puede mostrarse también el flujo de **reportes internos** hacia administración. El *shell* ofrece **Reportar problema** a roles distintos de `ADMIN`.
- **Escáner de acceso** (personal habilitado) — **`/app/acceso/escaner`**.

---

## 6. Docente (`DOCENTE`)

- Consultar **grupos** y contexto académico desde **Inicio** y **`/app/modulos/academico`**.
- **Horario** — **`/app/horario`**.
- **Asistencia** y **actividades con calificaciones** — flujos dentro de **`/app/modulos/academico`** y **`/app/modulos/calificaciones-docente`**.
- **Consulta de calificaciones** de estudiantes (donde aplique a su rol) y **boletines** — **`/app/modulos/boletines`**.
- **Circuito de recogida:** **`/app/circuito/hoy`**, detalle **`/app/circuito/:id`**; apoyo al flujo RF3 según reglas institucionales.
- **Anotaciones de atención** — **`/app/modulos/anotaciones-docente`**.
- **Escáner de acceso** — **`/app/acceso/escaner`** (RF2).
- **Importar y exportar** — **`/app/importaciones`** (cuando la institución habilita el rol en la importación).
- **Comunicación y agenda:** **`/app/modulos/comunicacion`**, **`/app/modulos/reuniones`**, **`/app/modulos/visitas-externas`** pueden alcanzarse por **URL directa** o enlaces contextuales aunque no aparezcan en el menú lateral para ese rol; la **API** define al final qué operaciones están permitidas. **Reportar problema** en el *shell* está disponible para roles distintos de `ADMIN`.

---

## 7. Padre o tutor (`PADRE`)

- **Inicio**, **Mi perfil** (incluye gestión de **consentimiento de salida** vinculado al circuito cuando la institución lo usa) y **`/app/circuito`** para **solicitud y seguimiento** del circuito de recogida (RF3), incluyendo variantes de **solo consentimiento** según la solicitud.
- **Comunicación:** avisos y notificaciones — **`/app/modulos/comunicacion`**; registro de notificaciones *push* depende de permisos del navegador y FCM configurado. Puede usar **Reportar problema** en el *shell* (no aplica al rol `ADMIN`).
- **Académico** (vista familia) — **`/app/modulos/academico`**.
- **Calificaciones** de los hijos — entrada de menú **Calificaciones** → **`/app/modulos/mis-calificaciones`**.
- **Boletines** — **`/app/modulos/boletines`**.
- **Finanzas:** deudas y carga de **comprobantes** — **`/app/modulos/finanzas`**.
- **Visitas externas** y **reuniones** — **`/app/modulos/visitas-externas`**, **`/app/modulos/reuniones`**.

---

## 8. Alumno (`ALUMNO`)

- **Horario** — **`/app/horario`**.
- **Mis calificaciones** — **`/app/modulos/mis-calificaciones`**.
- **Boletines** — **`/app/modulos/boletines`**.
- **Finanzas** (deudas propias) — **`/app/modulos/finanzas`**.
- **Visitas externas** y **reuniones** — **`/app/modulos/visitas-externas`**, **`/app/modulos/reuniones`** (entradas comunes del menú para todos los autenticados en `navConfig`).
- **Credencial QR** u otro mecanismo de acceso físico, si la institución habilita el flujo: consulta desde **Mi perfil** según implementación (RF2).

*Nota:* **Reportar problema** en el *shell* está disponible para el rol estudiante al igual que para otros roles no `ADMIN`.

---

## 9. Buenas prácticas de uso

- Cerrar sesión en **equipos compartidos**.
- No compartir **credenciales** ni capturas con datos sensibles de menores.
- Mantener el **navegador** actualizado; permitir **notificaciones** solo en dispositivos propios.
- Ante **inconsistencias** de datos (alumno duplicado, vínculo padre–hijo, nota o asistencia errónea), contactar a la **institución**; el manual no sustituye el canal oficial de soporte.

---

## 10. Flujo guiado — padre o tutor

1. Iniciar sesión en **`/login`**.
2. Revisar **Inicio**, **comunicación** y bandeja de notificaciones.
3. Consultar información académica en **`/app/modulos/academico`**, **Calificaciones** y **Boletines**.
4. Crear o seguir **solicitud de circuito** en **`/app/circuito`**; abrir **detalle** en **`/app/circuito/:id`** cuando aplique.
5. Actualizar **avance o ubicación** solo si el flujo de la solicitud lo solicita (mapa o estados según pantalla).
6. **Confirmar entrega** cuando el protocolo institucional y el estado de la solicitud lo permitan (no adelantar confirmación).
7. Consultar **Finanzas** y cargar **comprobante** si hay deuda pendiente y la institución exige evidencia.

---

## 11. Flujo guiado — docente

1. Iniciar sesión y revisar **Inicio** (`/app`).
2. Consultar **Horario** o **`/app/modulos/academico`** según la jornada.
3. Registrar **asistencia** y **actividades** desde los flujos del módulo académico y **`/app/modulos/calificaciones-docente`**.
4. Gestionar **Circuito del día** en **`/app/circuito/hoy`** y **detalle** en **`/app/circuito/:id`**.
5. Registrar **anotaciones** en **`/app/modulos/anotaciones-docente`** cuando aplique.
6. Usar **Escáner de acceso** en **`/app/acceso/escaner`** si la institución asigna control de ingreso/salida con QR/NFC.

---

## 12. Flujo guiado — administración institucional

1. Configurar **Institución**, **periodos** y datos base: **`/app/institucion`**, **`/app/modulos/periodos-academicos`**.
2. Crear **grupos, estudiantes, docentes y padres** en **`/app/gestion-escolar`**; vincular relaciones en los flujos de esa pantalla.
3. Ejecutar **importaciones** y revisar historial en **`/app/importaciones`**.
4. Administrar **Finanzas** en **`/app/modulos/finanzas`**.
5. Supervisar **circuito**, **asistencia** y **reportes** desde **Administración e informes** y módulos afines.
6. Exportar informes cuando la UI ofrezca descarga (coherente con rutas API de exportación, **Anexo 08**).

---

## 13. Mensajes y situaciones frecuentes

| Situación | Acción recomendada |
| --- | --- |
| Credenciales inválidas | Verificar correo y contraseña; usar **`/recuperar-contrasena`** si hay correo configurado. |
| Cuenta inactiva | Contactar administración institucional o de plataforma. |
| No autorizado (403) | Confirmar **rol**, escuela asignada y **vínculo** con estudiante o grupo. |
| Circuito deshabilitado | Esperar habilitación en configuración institucional o contactar administración. |
| Comprobante rechazado | Leer observación en pantalla; cargar nuevo archivo si el flujo aún permite intentos. |
| Archivo o boletín no disponible | Confirmar permisos, existencia del recurso y política de privacidad aceptada. |
| Aviso de privacidad pendiente | Leer hasta el final el texto y **aceptar** en el flujo de `PrivacyGate`; si hay error de carga, revisar conexión o contactar administración. |
| Demasiadas solicitudes (429) | Esperar unos minutos; si persiste, informar a la institución (límite de tasa en servidor). |

---

## 14. Capturas y figuras para el TDG

Insertar en la versión maquetada (capturas reales o *placeholders* etiquetados según norma del programa):

- [Figura 1. Inicio de sesión Escuela Pass — `/login`]
- [Figura 2. Menú lateral o *shell* autenticado según rol]
- [Figura 3. Circuito de recogida — vista familia — `/app/circuito`]
- [Figura 4. Escáner de acceso QR/NFC — `/app/acceso/escaner`]
- [Figura 5. Actividades y notas — docente — `/app/modulos/calificaciones-docente`]
- [Figura 6. Finanzas y comprobantes — `/app/modulos/finanzas`]
- [Figura 7. Panel administrativo u operativo — `/app/modulos/administracion` o Inicio por rol]
- [Figura 8. (Opcional) Comunicación y/o **Reportar problema** en el *shell* — RF7]

Las **figuras 1–5** del **Anexo 06** pueden reutilizarse si mantienen la misma semántica y resolución adecuada para impresión.

---

## 15. Inventario de rutas de interfaz por perfil (referencia)

Referencias bajo prefijo **`/app`** salvo nota; la visibilidad en el menú lateral depende de `navVisibleForRole` en `navConfig.ts`.

**Nota:** La tabla resume **rutas habituales**; no todas tienen **`RoleGate`** en `App.tsx` (véase **§16.1**). La denegación definitiva de una operación la emite la **API** con **403** o mensaje de negocio.

| Perfil | Rutas / módulos prioritarios |
| --- | --- |
| **PADRE** | `/app`, `/app/perfil`, `/app/circuito`, `/app/modulos/comunicacion`, `/app/modulos/academico`, `/app/modulos/mis-calificaciones`, `/app/modulos/boletines`, `/app/modulos/finanzas`, `/app/modulos/visitas-externas`, `/app/modulos/reuniones` |
| **DOCENTE** | `/app`, `/app/horario`, `/app/modulos/academico`, `/app/modulos/calificaciones-docente`, `/app/modulos/anotaciones-docente`, `/app/circuito/hoy`, `/app/circuito/:id`, `/app/acceso/escaner`, `/app/importaciones`, `/app/modulos/boletines`, **`/app/modulos/comunicacion`**, **`/app/modulos/reuniones`**, **`/app/modulos/visitas-externas`** (acceso frecuente por URL o módulos; sin `RoleGate` dedicado en `App.tsx` — validación en servidor) |
| **ADMINISTRATIVO** | `/app`, `/app/gestion-escolar`, `/app/importaciones`, `/app/modulos/finanzas`, `/app/modulos/periodos-academicos`, `/app/modulos/visitas-externas`, `/app/modulos/reuniones`, `/app/modulos/administracion`, `/app/circuito/hoy`, `/app/circuito/:id`, `/app/acceso/escaner`, `/app/institucion`, `/app/modulos/boletines`, `/app/modulos/calificaciones-docente`, `/app/modulos/anotaciones-docente`, `/app/horario` |
| **ADMIN** | Incluye **`/app/escuelas`** y subconjunto operativo según necesidad; **`/app/circuito`** y **`/app/circuito/hoy`** están permitidos en `RoleGate` (vista familia vs operación del día); el menú lateral prioriza **`/app/circuito/hoy`** según `navConfig`. |
| **ALUMNO** | `/app`, `/app/horario`, `/app/modulos/mis-calificaciones`, `/app/modulos/boletines`, `/app/modulos/finanzas`, `/app/perfil`, `/app/modulos/reuniones`, `/app/modulos/visitas-externas`, `/app/institucion`, `/app/modulos/comunicacion` |

---

## 16. Líneas de mejora profesional, académicas y de completitud (manual de usuario)

Las recomendaciones siguientes surgen de contrastar este anexo con **`App.tsx`**, **`navConfig.ts`**, pantallas bajo `frontend/src/pages/`, el **Anexo 01** (RF/RNF), el modelo del **Anexo 04** y la estrategia de pruebas del repositorio (`test/*.e2e-spec.ts`).

### 16.1 Menú lateral, `RoleGate` y autorización real

No toda ruta bajo `/app` tiene **`RoleGate`** en el cliente: varias pantallas exigen solo sesión y delegan el control fino a la **API**. El menú (`navConfig`) **oculta** entradas por rol, pero un usuario podría abrir una **URL directa** y ver un formulario antes de recibir **403** en una acción.  

- **Profesional:** al evolucionar el producto, o bien alinear menú y `RoleGate`, o bien documentar explícitamente “**validación en servidor**” por pantalla en el **Anexo 06**.  
- **Académico:** en defensa, distinguir **seguridad en profundidad** (API como frontera verdadera) frente a **experiencia de usuario** (ocultar lo no usable).

### 16.2 RF7: comunicación, reportes administrativos y “Reportar problema”

El **Anexo 01** exige avisos, notificaciones y **reportes administrativos** (`notifications/admin-reports/*`). En interfaz, parte del flujo vive en **`/app/modulos/comunicacion`** (`Operativos.tsx`) y el *shell* expone **Reportar problema** (`AppShell.tsx`) a todos los roles **excepto** `ADMIN`, que no ve ese botón en la implementación actual.  

- **Profesional:** incluir en versiones futuras del manual una **mini-subsección** o captura dedicada a ese flujo para auditores que busquen RF7 literal.  
- **Académico:** enlazar en el **Anexo 10** un escenario de prueba o encuesta que mencione este canal (cierre de bucle RNF5).

### 16.3 Privacidad, consentimiento y marco normativo en el texto del producto

`PrivacyGate` bloquea la app hasta aceptar la política vigente; los comentarios de código citan marco de referencia distinto al que el **Anexo 01** puede usar para el caso colombiano.  

- **Académico:** el **cuerpo principal del TDG** o el **Anexo 03** deben fijar un **único marco legal** aplicable al estudio; el manual solo debe decir que el usuario **debe aceptar** el aviso antes de operar.  
- **Profesional:** evitar que capturas del manual muestren datos reales de menores (**datos sintéticos**).

### 16.4 Perfil `ADMIN` y rutas de circuito

`RoleGate` permite tanto **`/app/circuito`** (vista orientada a familia) como **`/app/circuito/hoy`** para `ADMIN`, mientras el menú lateral enfatiza el circuito operativo del día para roles de plantel.  

- **Recomendación:** en demos y capturas, explicitar **qué vista usa el administrador de plataforma** en cada escenario para no confundir al lector con dos URL distintas bajo “circuito”.

### 16.5 Cobertura de pruebas automatizadas vs. riqueza del manual

Los escenarios **E2E** del repositorio son **subconjunto** de los flujos que describe este anexo (varios archivos `*.e2e-spec.ts`, no sustitutos de prueba de usabilidad).  

- **Académico:** el **Anexo 10** debe declarar honestamente **qué flujos del manual** tienen evidencia automática y cuáles solo evidencia manual o piloto con usuarios.  
- **Profesional:** si se exige trazabilidad en la evaluación, una matriz **paso del manual ↔ caso E2E / prueba piloto** reduce riesgo de sobre-reclamo.

### 16.6 Rendimiento percibido (RNF4) y operaciones pesadas

Importaciones, exportaciones Excel, generación de PDFs y listados amplios pueden afectar la **experiencia** sin contradecir el manual si no se documentan **tiempos esperados**.  

- **Recomendación:** en el **Anexo 10**, medir al menos una operación pesada desde UI y citar entorno; el manual puede añadir una nota genérica de “**puede tardar según volumen**” junto a importaciones/exportaciones si se valida con usuarios.

### 16.7 Accesibilidad y usabilidad móvil (RNF5)

El producto es **responsive**; flujos críticos (padre/tutor, escáner) dependen del dispositivo y permisos (cámara, notificaciones).  

- **Profesional:** checklist **WCAG 2.1** nivel mínimo (contraste, foco visible, etiquetas) documentado en el **Anexo 07** (**§13.7**) y reflejado en capturas del **§14** de este anexo.  
- **Académico:** resultados de **prueba con usuarios** (Anexo 10) deben citar dispositivos y roles probados.

### 16.8 Integraciones opcionales y degradación controlada

**SMTP**, **FCM** y **mapas** pueden estar **desactivados** según variables (**Anexo 07**). El manual ya advierte SMTP; debe mantenerse alineado con el **Anexo 01** para no prometer recuperación de clave, *push* o ETA si la demo **no** los configura.

### 16.9 Sincronización documental (`App.tsx` / Anexo 06 / Anexo 08)

Cualquier nuevo `Route` o entrada de `SIDEBAR_NAV` debe actualizar **§15**, el **Anexo 06** (**§9–§10**) y, si expone nueva API, el **Anexo 08**. Considerar un **procedimiento de release** documental en el **Anexo 07** (ya sugerido para `tdg:enrich` en API).

### 16.10 Priorización sugerida

1. Cerrar **§14** con capturas reales o *placeholders* rotulados y **RF7** visible (**§16.2**).  
2. Fijar **marco de privacidad** académico vs. comentarios de código (**§16.3**).  
3. Matriz **manual ↔ pruebas** para evidencia de validación (**§16.5**).  
4. Afinar texto sobre **menú vs servidor** en una nota breve al inicio del **§15** (**§16.1**).  
5. Evidencia **RNF4/RNF5** en **Anexo 10** (**§16.6–16.7**).

---

## 17. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—pantallas—evidencia; coherencia con **§15**; honestidad cobertura (**§16.5**). |
| 01 | Actores, RF1–RF8, reglas y límites de alcance; RF7 y degradación (**§16.2**, **§16.8**). |
| 03 | Arquitectura del cliente, privacidad y seguridad percibida; marco legal vs. UI (**§16.3**). |
| 04 | Datos mostrados (familia, académico, pagos). |
| 05 | Casos de uso y secuencias que estos flujos instancian. |
| 06 | Inventario de pantallas, **§9–§10** rutas y `RoleGate`; sincronización (**§16.1**, **§16.9**). |
| 07 | Despliegue, URL del cliente, SMTP y variables; WCAG (**§16.7**). |
| 08 | Operaciones REST detrás de cada pantalla; autorización fina (**§16.1**). |
| 10 | Informe de pruebas y métricas: matriz manual ↔ E2E (**§13.4** del **Anexo 10**); **RNF4/RNF5** (**§6**, **§10** allí). |

---

*Fin del anexo 09 — Manual de usuario.*
