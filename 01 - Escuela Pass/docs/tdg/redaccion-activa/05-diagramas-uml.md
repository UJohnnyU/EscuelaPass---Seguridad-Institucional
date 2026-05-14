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

Este anexo agrupa los diagramas UML que explican el comportamiento del sistema a nivel de actores, flujos críticos y organización del backend. Complementa los requerimientos del **Anexo 01**, la arquitectura del **Anexo 03**, el modelo de datos del **Anexo 04**, el inventario de interfaz del **Anexo 06** y el **informe de pruebas** del **Anexo 10**, sin sustituir el código ni los contratos HTTP del **Anexo 08**.

---

## 2. Casos de uso

**Actores:** administrador de plataforma, personal administrativo o director, docente, padre o tutor, alumno y —según los módulos habilitados— figuras asociadas a visitas o agenda institucional.

Los casos se agrupan en correspondencia con **RF1–RF8** de la propuesta aceptada: autenticación y privacidad; accesos físicos (QR/NFC); circuito de recogida; gestión escolar; ámbito académico y asistencia; finanzas; comunicación; *dashboard* y reportes.

[Figura 1. Diagrama UML de casos de uso Escuela Pass (centrado en actores y paquetes RF1–RF8)]

---

## 3. Secuencia del circuito de recogida

**Flujo principal:**

1. El padre o tutor inicia sesión.
2. Crea una solicitud de circuito para un estudiante con vínculo autorizado (`student_parents`, **Anexo 04**).
3. El backend valida la relación padre–estudiante, el estado del circuito y la configuración institucional (p. ej. circuito habilitado, reglas de asistencia del día según implementación).
4. Se persiste la solicitud y se notifica al personal docente o administrativo según el flujo operativo.
5. El padre puede actualizar el avance o la ubicación informativa (GPS) asociada a la solicitud.
6. El personal gestiona autorización, entrega, cancelación o confirmación conforme a los estados del dominio.

La interpretación de negocio del **RF3** (circuito familiar operado por padres o tutores) es la misma que en el **Anexo 01** y el **Anexo 03**.

[Figura 2. Diagrama de secuencia del circuito de recogida (del cliente padre/tutor al API y actores institucionales)]

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
