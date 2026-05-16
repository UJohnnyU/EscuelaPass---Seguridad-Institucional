# ESCUELA PASS — Administración y seguridad escolar

## 05. Diagramas UML Escuela Pass

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
**Tipo de documento:** Casos de uso, secuencia y clases de contexto  
**Versión:** 1.0 documental  

---

## 1. Propósito

**Nota de acrónimos del anexo.** **UML** (Unified Modeling Language; OMG, 2017), **OMG** (Object Management Group), **API** (Application Programming Interface), **REST** (Representational State Transfer; Fielding, 2000), **JWT** (JSON Web Token), **QR** (Quick Response), **NFC** (Near Field Communication), **FCM** (Firebase Cloud Messaging), **GPS** (Global Positioning System), **E2E** (*end-to-end*).

Este anexo agrupa los diagramas UML que explican el comportamiento del sistema a nivel de actores, flujos críticos y organización del backend. Sigue la notación normativa **UML 2.5.1** publicada por la **Object Management Group** (OMG, 2017) y se apoya en literatura aplicada a la modelación orientada a objetos (Booch et al., 2007; Pressman & Maxim, 2020). Complementa los requerimientos del **Anexo 01**, la arquitectura del **Anexo 03**, el modelo de datos del **Anexo 04**, el inventario de interfaz del **Anexo 06** y el **informe de pruebas** del **Anexo 10**, sin sustituir el código ni los contratos HTTP del **Anexo 08**.

---

## 2. Casos de uso por actor (exhaustivos)

Los casos de uso se enumeran por actor cubriendo todos los flujos accesibles a cada rol. Esta lista se sincroniza con el inventario de pantallas del **Anexo 06** y con el catálogo HTTP del **Anexo 08**.

### 2.1. Administrador de plataforma

| Caso de uso | Notas |
| --- | --- |
| Iniciar y cerrar sesión, recuperar contraseña, renovar token | Flujo de identidad común a todos los roles. |
| Aceptar políticas de privacidad y consultar políticas vigentes | Aceptación con marca temporal. |
| Crear, listar, editar e inactivar instituciones (escuelas) | Operación multi‑institución. |
| Asignar usuarios a una institución y reasignar contextos | Solo desde el rol de plataforma. |
| Restablecer contraseñas de usuarios institucionales | Acción administrativa. |
| Configurar parámetros institucionales y del circuito | Habilitación o deshabilitación del flujo de salida. |
| Consultar tableros y reportes consolidados de plataforma | Indicadores agregados. |
| Exportar reportes financieros, de asistencia, de calificaciones y de boletines | Formato Excel y PDF. |
| Consultar bitácora de auditoría | Rastreabilidad institucional. |
| Gestionar políticas de privacidad versionadas | Publicación y consulta de la última política. |
| Configurar credenciales NFC para usuarios | Asignación y revocación. |

### 2.2. Personal administrativo de una escuela

| Caso de uso | Notas |
| --- | --- |
| Iniciar y cerrar sesión, recuperar contraseña, renovar token | Flujo de identidad. |
| Aceptar políticas de privacidad | Marca temporal. |
| Crear, listar, editar e inactivar grupos, materias, estudiantes, docentes y padres | Núcleo de gestión escolar. |
| Vincular y desvincular relaciones padre–estudiante con autorización de recogida | Habilita el circuito familiar. |
| Importar nóminas, grupos, asignaciones y vínculos vía archivos Excel con plantillas | Flujo masivo con bitácora. |
| Consultar historial de importaciones | Auditoría operativa. |
| Configurar periodos académicos, abrirlos, cerrarlos y reabrirlos | Reglas de cierre. |
| Generar boletines del periodo y consolidar boletines finales | Documentos PDF. |
| Configurar calendario institucional y días no lectivos | Bloqueos automáticos en asistencia. |
| Gestionar horarios y franjas por grupo | Insumo del docente. |
| Registrar visitas externas, agendarlas, cancelarlas, reagendarlas, cerrarlas como realizadas | Agenda institucional. |
| Crear y gestionar reuniones con respuestas confirmadas | Convocatoria y RSVP. |
| Verificar o rechazar comprobantes de pago, gestionar conceptos, deudas y arreglos | Cartera con revisión humana. |
| Ejecutar políticas automatizadas de cartera | Trabajos programados. |
| Recibir y atender reportes administrativos con seguimiento por SLA | Tickets internos. |
| Consultar tablero institucional, reportes operativos y exportaciones | Indicadores y descargas. |
| Operar el circuito desde el lado institucional (autorizar salida, confirmar entrega, cancelar) | RF3 lado escuela. |
| Subir logos institucionales y administrar archivos | Recursos visuales y documentales. |

### 2.3. Docente

| Caso de uso | Notas |
| --- | --- |
| Iniciar y cerrar sesión | Identidad. |
| Aceptar políticas de privacidad | Marca temporal. |
| Consultar sus asignaciones (grupos y materias) y horario | Configurado por administración. |
| Registrar asistencia diaria por grupo (individual y masiva) | Reglas de día no lectivo. |
| Registrar asistencia por sesión de clase (individual y masiva) | Soporte para tardanzas. |
| Crear, editar y cerrar actividades académicas | Cierre con reglas de periodo. |
| Registrar y editar calificaciones por actividad | Validación por escala. |
| Reabrir una actividad cerrada con justificación | Acción auditada. |
| Registrar anotaciones de atención al estudiante | Seguimiento socioafectivo. |
| Operar el escáner de credencial QR/NFC en clase | Asistencia automática. |
| Apoyar el circuito desde el aula (señal docente al circuito activo) | Coordinación con portería. |
| Consultar avisos institucionales y notificaciones personales | Bandeja por usuario. |
| Generar reportes de asistencia y calificaciones de sus grupos | Exportación Excel/PDF. |

### 2.4. Padre o tutor

| Caso de uso | Notas |
| --- | --- |
| Iniciar y cerrar sesión, recuperar contraseña, renovar token | Identidad. |
| Aceptar políticas de privacidad | Obligatoria al primer ingreso. |
| Consultar el listado de hijos vinculados con autorización de recogida | Visibilidad limitada por relación. |
| Iniciar una solicitud de circuito por hijo y por día | Una sola activa por estudiante por día. |
| Actualizar la ubicación geográfica del trayecto | Si el dispositivo lo permite. |
| Avanzar manualmente el estado del circuito (en camino, llegando, en plantel) | Coordinación con portería. |
| Confirmar entrega del estudiante | Cierre del flujo familiar. |
| Cancelar la solicitud del circuito | Antes de la entrega. |
| Registrar y administrar vehículos familiares | Información para portería. |
| Registrar consentimiento de salida diario | Habilita la entrega. |
| Justificar inasistencia con excusa y archivo adjunto | Evidencia subida controladamente. |
| Consultar la asistencia, calificaciones, boletines, horario y calendario del hijo | Visibilidad académica. |
| Cargar comprobantes de pago y consultar el estado de la deuda | Sin pasarela bancaria automática. |
| Recibir avisos institucionales y notificaciones personales | Push opcional. |
| Solicitar reuniones o visitas y responder a convocatorias | RSVP. |
| Consultar anotaciones de atención del hijo | Seguimiento socioafectivo. |

### 2.5. Alumno

| Caso de uso | Notas |
| --- | --- |
| Iniciar y cerrar sesión | Identidad. |
| Aceptar políticas de privacidad | Marca temporal. |
| Consultar su credencial de acceso QR personal | Para presentación en portería. |
| Consultar su horario y calendario académico | Lecturas autorizadas. |
| Consultar sus calificaciones por actividad y boletines | Solo del propio alumno. |
| Consultar su asistencia diaria y por clase | Solo del propio alumno. |
| Consultar avisos institucionales que le aplican | Bandeja personal. |
| Recibir notificaciones personales | Push opcional. |
| Consultar consentimiento de salida del día | Si la institución lo expone. |

*[Figura 1. Diagrama UML de casos de uso Escuela Pass agrupado por los cinco actores y los paquetes funcionales del producto. Recomendado: Lucidchart con Lucid AI.]*

---

## 3. Secuencias clave

### 3.1. Secuencia del circuito de recogida familiar

1. El padre o tutor inicia sesión y selecciona al hijo correspondiente con vínculo de recogida autorizado.
2. Solicita iniciar el circuito del día; el servicio valida la relación familiar, el estado del circuito (habilitado por la institución), la asistencia del estudiante y la unicidad de solicitud por día.
3. El servicio persiste la solicitud y emite notificación al personal docente o administrativo del grupo afectado.
4. El padre o tutor actualiza opcionalmente la geolocalización; si entra al radio del plantel, el servicio puede transitar automáticamente a estado de notificación de llegada.
5. El docente o administrativo señala que el estudiante está listo para salir; el padre confirma la entrega o, en su caso, la operación se cancela según las reglas del dominio.

*[Figura 2. Diagrama de secuencia del circuito de recogida desde el cliente del padre o tutor hasta los actores institucionales. Recomendado: Lucidchart con Lucid AI.]*

### 3.2. Secuencia de escaneo QR de credencial estudiantil

1. El docente o el personal de seguridad opera el escáner del cliente web sobre la cámara del dispositivo.
2. El cliente decodifica la credencial QR y envía la lectura al servicio.
3. El servicio valida la credencial, el contexto institucional (escuela, grupo si aplica) y aplica la regla de ventana de duplicidad: dentro de los segundos posteriores a una lectura idéntica, no se genera un nuevo evento.
4. El servicio persiste el evento de acceso y, cuando corresponde, marca asistencia diaria automáticamente o registra tardanza si la lectura ocurre fuera del horario tolerado.
5. El cliente muestra al operador un mensaje de confirmación o alerta según el resultado.

*[Figura 3. Diagrama de secuencia del escaneo QR de credencial con regla antiduplicación y marcado automático de asistencia. Recomendado: Lucidchart con Lucid AI.]*

### 3.3. Secuencia de pago con comprobante (revisión humana)

1. El padre o tutor consulta sus deudas filtradas por hijo y selecciona la deuda a pagar.
2. Adjunta la imagen o PDF del comprobante bancario y describe los datos requeridos (referencia, fecha, monto pagado).
3. El servicio almacena el comprobante en el área privada de archivos y deja la deuda en estado pendiente de revisión.
4. El personal administrativo accede a la bandeja de revisiones, consulta el comprobante y verifica o rechaza el pago, registrando observaciones.
5. Si verifica, la deuda transita a saldada o parcialmente saldada según el monto; si rechaza, se notifica al padre con el motivo y se permite cargar un comprobante corregido.

*[Figura 4. Diagrama de secuencia de pago con verificación humana de comprobante, sin pasarela bancaria automática. Recomendado: Lucidchart con Lucid AI.]*

### 3.4. Secuencia de cierre de actividad académica con calificaciones

1. El docente accede a una actividad creada por él para un grupo y materia asignados.
2. Registra calificaciones individuales por estudiante y, opcionalmente, comentarios.
3. Cierra la actividad invocando la operación de cierre; el servicio valida que el periodo académico esté abierto y que la actividad cumpla las reglas configuradas.
4. El servicio bloquea ediciones futuras salvo reapertura justificada con auditoría.
5. La consolidación de boletines puede ejecutarse al cierre del periodo, generando documentos PDF por estudiante.

*[Figura 5. Diagrama de secuencia de cierre de actividad con calificaciones y bloqueo posterior. Recomendado: Lucidchart con Lucid AI.]*

---

## 4. Clases / contexto

La vista de clases se presenta como **contexto** controlador–servicio–repositorio–entidad, por dominios NestJS, para evitar un diagrama exhaustivo de todas las entidades TypeORM. El patrón se repite en los *bounded contexts* registrados en `AppModule` (**Anexo 03**), tomando como ejemplos representativos uno o dos módulos por familia (p. ej. circuito, asistencia, autenticación).

[Figura 3. Diagrama de clases de contexto NestJS y persistencia TypeORM]

---

## 5. Evidencia en el repositorio

Base técnica para elaborar o revisar los diagramas:

- Cliente: `frontend/src/App.tsx`, `frontend/src/navigation/navConfig.ts` (navegación por rol y rutas).
- Servidor: `src/app.module.ts`, módulos y controladores bajo `src/modules/`, servicios de dominio y DTOs asociados.
- Persistencia: entidades en `src/database/entities/` y correspondencia tabla–archivo en el **Anexo 04**, §8.

Si los diagramas se exportan desde Lucidchart u otra herramienta, deben respetar los **nombres de módulos y rutas reales** del proyecto, no etiquetas genéricas.

---

## 6. Figuras exportadas (referencia Mermaid)

*Casos de uso generales por actor (exportado desde Mermaid).*

[Figura 4. Casos de uso generales por actor]

*Secuencia del circuito de recogida (exportado desde Mermaid).*

[Figura 5. Secuencia del circuito de recogida]

Las figuras 4 y 5 pueden coincidir en contenido con las figuras 1 y 2 cuando se inserte la misma exportación en el documento maquetado. En la redacción del anexo se distinguen la **versión UML orientada al TDG** (figuras 1–3) y las **versiones gráficas listas para impresión** (figuras 4–5) cuando la maquetación institucional lo requiera.

---

## 7. Prompt para Lucidchart

Redactar tres diagramas UML para Escuela Pass:

1. **Casos de uso por actores:** administrador de plataforma, personal administrativo o director, docente, padre o tutor y alumno; agrupar casos según RF1–RF8 y módulos reales del frontend.
2. **Secuencia del circuito de recogida:** desde la solicitud del padre o tutor hasta la confirmación de entrega o cierre equivalente, incluyendo validaciones y notificaciones pertinentes.
3. **Diagrama de componentes o despliegue lógico:** cliente React/Vite, API NestJS, PostgreSQL, almacenamiento privado de archivos (*uploads*), FCM, SMTP y Mapbox (u homólogo de mapas), usando nombres de módulos y artefactos del repositorio.

Mantener los diagramas legibles, con notas breves bajo cada figura si el manual o la plantilla institucional lo requieren.

---

## 8. Escenarios cubiertos en pruebas de extremo a extremo

El archivo `test/app.e2e-spec.ts` agrupa pruebas bajo el bloque `describe('App (e2e)', …)`. La siguiente lista recoge los identificadores textuales de los casos `it(…)` en el orden en que aparecen en el repositorio; sirve como **trazabilidad** entre rutas HTTP, reglas de negocio y evidencia automática, en articulación con el **Anexo 00** y el **Anexo 10** cuando allí se consolide el plan de pruebas.

- `health (GET)`
- `auth: login -> refresh rotacion -> logout invalida refresh`
- `auth: refresh token invalido y logout invalido responden 401`
- `attendance: admin registra y upsert actualiza`
- `calendario: día sin clases bloquea registro de asistencia y export Excel`
- `access scan: ENTRY de alumno por QR marca asistencia automatica`
- `class-attendance: docente registra asistencia por clase y padre la consulta`
- `access scan: ENTRY tardio marca RETARDO sin pisar asistencia manual`
- `grades: docente registra y padre puede leer`
- `circuit + reports: circuito hoy y reportes responden`
- `circuit: docente solo ve solicitudes de alumnos en su clase actual`
- `circuit: sin registro presente/tardanza hoy bloquea solicitud del padre`
- `authz: padre no puede registrar asistencia (403)`
- `validation: asistencia con studentId invalido responde 400`
- `authz: padre no puede consultar reportes de pagos pendientes (403)`
- `school: administrativo lista grupos`
- `exports: Excel asistencia, calificaciones y boletín consolidado`
- `settings: perfil institucional lectura y actualización admin`
- `settings: circuito deshabilitado bloquea nuevas solicitudes de circuito`
- `circuit: padre actualiza GPS de su solicitud`
- `circuit: padre confirma entrega de su solicitud`
- `dashboard: admin consulta resumen y padre recibe 403`
- `school import: admin carga grupos por Excel y padre no puede`
- `school import: asignaciones por Excel y plantilla xlsx`
- `school import: historial de importaciones disponible para admin`
- `visitas, reuniones y horarios: padre solicita y staff responde`
- `lifecycle: transición alumno/docente con bloqueo operativo e historial`
- `t10/t11: SLA reportes + acuse crítico + recordatorio manual`
- `t12/t13: políticas de cartera + bitácora de ajustes`
- `t14: circuito GPS — auto-transición a NOTIFICADO_LLEGADA al entrar al radio`
- `t15: NFC — asignar, listar y revocar credencial`
- `t16: reuniones, visitas y anotaciones (padre) responden tras restaurar módulos`
- `t17: admin-reports (tickets SLA) están disponibles`

La cobertura funcional alcanzable desde la interfaz y estos escenarios debe mantenerse alineada con la **matriz del Anexo 00** cuando evolucione el repositorio.

---

## 9. Relación con otros anexos del TDG

| Anexo | Contenido vinculado a este documento |
| --- | --- |
| 00 | Matriz RF/RNF—implementación—evidencia; trazabilidad con rutas y pruebas. |
| 01 | Actores, RF1–RF8 y reglas de negocio que los diagramas ilustran. |
| 02 | Actas con AlfaNetworks como referencia funcional (p. ej. circuito familiar). |
| 03 | Módulos NestJS, vista lógica y despliegue que los diagramas de componentes o contexto reflejan. |
| 04 | Entidades y relaciones citadas en secuencia o casos de uso (p. ej. `student_parents`, `circuit_requests`). |
| 06 | Inventario de rutas y prototipos (**§3**, **§9–§10**); bases para figuras de casos de uso. |
| 07 | Entorno local y despliegue para ejecutar cliente y API en pruebas de flujo. |
| 08 | **Anexo 08** (§3, §7, §10): contratos HTTP que concretan mensajes en diagramas de secuencia. |
| 09 | **Anexo 09**: flujos de usuario que materializan actores y pasos descritos en UML. |
| 10 | Informe de pruebas y métricas (**Anexo 10**): plan, E2E (**§8**) y matriz RF (**§9**). |

---

*Fin del anexo 05 — Diagramas UML.*
