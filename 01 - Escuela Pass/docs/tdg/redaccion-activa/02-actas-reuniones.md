# ESCUELA PASS — Administración y seguridad escolar

## 02. Actas de reuniones AlfaNetworks Escuela Pass

**Jhon Kevin Murillo Martínez**  
Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones (APIT)  
Facultad de Ingenierías — Politécnico Colombiano Jaime Isaza Cadavid  

**Tipo de documento:** Anexo documental del trabajo de grado  
**Año:** 2026  

---

**Proyecto:** Escuela Pass — Administración y seguridad escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Contraparte funcional:** AlfaNetworks  
**Tipo de documento:** Actas de reunión (constancia de acuerdos)  
**Versión:** 1.0 documental  

---

## Introducción

El presente anexo consolida las **actas de reunión** celebradas entre el **Politécnico Colombiano Jaime Isaza Cadavid** (a través del autor del trabajo de grado) y **AlfaNetworks**, en el marco del desarrollo del sistema **Escuela Pass**. Las actas registran **hechos y acuerdos** de negocio y de producto alcanzados en dichas sesiones. Los datos administrativos de cada sesión (fecha y lugar o modalidad) se completan al pie de cada acta antes de la firma.

**Asistentes**

- **Jhon Kevin Murillo Martínez** — Ingeniería Informática (APIT), Politécnico Colombiano Jaime Isaza Cadavid; autor del trabajo de grado y responsable del desarrollo del producto Escuela Pass en articulación con AlfaNetworks.
- Representante de **AlfaNetworks**: _____________________________________________ (nombre completo y cargo).
- Asesor del trabajo de grado (Politécnico Colombiano Jaime Isaza Cadavid): **Alirio Antonio Gutiérrez Quintero**, cuando corresponda a la sesión.

---

## 1. Acta — Levantamiento inicial de necesidades

**Fecha:** ___________________________  
**Lugar o modalidad:** ___________________________

**Objetivo:** identificar el problema institucional, los actores del dominio escolar y el alcance esperado de Escuela Pass.

**Acuerdos:**

- Priorizar **seguridad escolar**, **administración académica**, **comunicación** y **control de accesos** como pilares del producto.
- Adoptar una solución **web responsive** para el MVP, evitando aplicaciones móviles nativas en ese alcance inicial.
- Definir los roles de uso: administrador de plataforma (alcance multi-institución cuando aplique), personal administrativo de la institución, docente, padre o tutor, y alumno.
- Dar trato documentado a **datos personales** (incluidos menores de edad), **privacidad**, **consentimiento** y **controles de acceso** en la medida en que el producto los implemente.

---

## 2. Acta — Requerimientos funcionales y no funcionales

**Fecha:** ___________________________  
**Lugar o modalidad:** ___________________________

**Objetivo:** alinear el alcance del producto con los requerimientos de la propuesta de trabajo de grado (RF1–RF8, RNF1–RNF6) y con la operación que AlfaNetworks espera del sistema.

**Acuerdos:**

- El **circuito de recogida (RF3)** es **iniciado y operado por padres o tutores** desde la aplicación web en dispositivos móviles; no corresponde, en el alcance acordado, a una flota escolar gestionada por un tercero independiente.
- **Pagos:** no se incorpora **pasarela de pago en línea** en el alcance acordado; se trabaja con **deuda**, **carga de comprobante** por la familia y **verificación** por personal autorizado.
- **Notificaciones:** uso de **bandeja interna** en la aplicación y posibilidad de **notificación push** mediante FCM según la configuración del despliegue.
- **Acceso al plantel:** uso de **QR** y **NFC** como medios de identificación en el puesto de control, con reglas de credencial y manejo de **lecturas duplicadas en ventana corta** según la implementación acordada con AlfaNetworks.
- **Identidad:** inclusión de flujos de **recuperación y restablecimiento de contraseña** cuando el entorno de correo (SMTP) esté disponible.
- Mantener **trazabilidad** de la operación a través de la **API**, la **base de datos PostgreSQL**, los **roles** y las **pruebas automatizadas** del repositorio del proyecto.

---

## 3. Acta — Diseño arquitectónico

**Fecha:** ___________________________  
**Lugar o modalidad:** ___________________________

**Objetivo:** fijar el *stack* tecnológico y el esquema de despliegue entre las partes.

**Acuerdos:**

- **Backend:** NestJS con TypeORM; **base de datos:** PostgreSQL.
- **Frontend:** React con Vite, orientado a despliegue como aplicación web estática.
- **Infraestructura:** despliegue de API y base de datos compatible con **Railway** según el documento de despliegue del proyecto; alojamiento estático del cliente en **Vercel** u **hosting** equivalente.
- **Mapas y ETA** del circuito: uso de **Mapbox** en el cliente; si no hay *token* o hay limitación de configuración, el comportamiento **degradado** se rige por la implementación acordada; cálculos de distancia **sin mapa interactivo** pueden apoyarse en **Haversine** donde aplique el dominio del circuito.
- **Seguridad de la API:** **límite global de peticiones** (*rate limiting*) y conjunto de **rutas públicas acotadas** (autenticación, salud, flujos de recuperación de credenciales, etc.).
- **Operación en servidor:** **tareas programadas** (calendario académico y eventos) y **correo transaccional** como apoyo a notificaciones y procesos internos, sin cambiar la enumeración RF/RNF de la propuesta; las ampliaciones de producto quedan descritas en la documentación técnica que acompaña al trabajo de grado.

---

## 4. Acta — Validación funcional

**Fecha:** ___________________________  
**Lugar o modalidad:** ___________________________

**Objetivo:** revisar conjuntamente el estado del producto frente a la propuesta y a la especificación acordada.

**Acuerdos:**

- Utilizar la documentación **OpenAPI/Swagger** expuesta por la API (`GET /docs` cuando esté habilitada) como referencia viva de contratos.
- Mantener **documentación técnica**, **manuales** que se acuerden y **pruebas automatizadas** en el repositorio; las pruebas *end-to-end* incluyen como mínimo los archivos `test/app.e2e-spec.ts`, `test/phase7-closure.e2e-spec.ts` y `test/auth-throttle-ip.e2e-spec.ts`, más rutinas de *smoke* o de integración continua que se definan en el proyecto.
- Dar tratamiento explícito a las **diferencias** entre el texto original de la propuesta y el producto desplegado como **evolución justificada** (infraestructura, bibliotecas de mapas o QR, etc.), documentada en el cuerpo o anexos del trabajo de grado donde corresponda.

---

## 5. Acta — Preparación de entrega

**Fecha:** ___________________________  
**Lugar o modalidad:** ___________________________

**Objetivo:** alinear la organización de los entregables del trabajo de grado y del producto frente al cierre académico.

**Acuerdos:**

- La organización del **texto desarrollado** y de los **anexos** del trabajo de grado atenderá las **directrices de extensión** del Politécnico Colombiano Jaime Isaza Cadavid.
- **Citación**, **estilo** y **originalidad** del documento final se ajustarán al **texto único del trabajo de grado** y a la normativa aplicable; la guía institucional completa no se incorpora a este anexo para evitar duplicación.
- Las **figuras y capturas** que acrediten acuerdos técnicos podrán **fundarse en evidencia reproducible** desde el producto o el repositorio; lo que no figure en esta acta podrá documentarse en la parte correspondiente del trabajo de grado, con la trazabilidad académica habitual.

---

## Relación con otros anexos del trabajo de grado

| Anexo | Relación |
| --- | --- |
| 00 | Matriz de trazabilidad entre requerimientos y evidencias en código y pruebas. |
| 01 | Especificación funcional y no funcional detallada. |
| 03–08 | Arquitectura, modelo de datos, UML, interfaz y API según el índice del TDG. |
| 09 | Manual de usuario (**Anexo 09**): guía por rol y flujos. |
| 10 | Informe de pruebas y métricas (**Anexo 10**): E2E, CI, **RNF4/RNF5**. |

---

## Constancia de conformidad y firmas

Las partes manifiestan que los acuerdos precedentes corresponden a lo tratado en las sesiones indicadas, una vez completadas la **fecha** y el **lugar o modalidad** en cada acta.

| Rol | Nombre y firma |
| --- | --- |
| Autor del trabajo de grado (Politécnico) | Jhon Kevin Murillo Martínez — _________________________ |
| Representante AlfaNetworks | _________________________ |
| Testigo o asesor (si aplica) | _________________________ |

**Lugar y fecha de suscripción del presente documento anexo:** _____________________________________________

---

*Fin del anexo 02 — Actas de reuniones AlfaNetworks Escuela Pass.*
