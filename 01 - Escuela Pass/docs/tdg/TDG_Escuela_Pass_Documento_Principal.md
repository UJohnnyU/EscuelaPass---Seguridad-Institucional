# Desarrollo De Aplicación Web De AlfaNetworks Con NestJS, PostgreSQL, Tecnologías NFC Y QR Para La Administración Y Seguridad Escolar: Escuela Pass

**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática  
**Facultad:** Ingenierías  
**Institución:** Politécnico Colombiano Jaime Isaza Cadavid  
**Asesor:** Alirio Antonio Gutiérrez Quintero  
**Tipo:** Documento principal del Trabajo de Grado  
**Nota:** Documento preparado para maquetación y revisión final sobre la plantilla institucional, con límite máximo de 50 páginas.

## Resumen

Escuela Pass es una aplicación web orientada a la administración y seguridad escolar en instituciones
educativas privadas. El proyecto responde a necesidades asociadas con control de accesos, gestión de
recogida de estudiantes, comunicación con familias, asistencia, calificaciones, pagos, reportes y
protección de datos personales. La solución se implementó con un backend NestJS, base de datos
PostgreSQL y frontend React/Vite, integrando tecnologías QR (Quick Response o respuesta rápida), NFC
(Near Field Communication o comunicación de campo cercano), JWT (JSON Web Token o token web JSON),
mapas, notificaciones y archivos privados.

El desarrollo conserva el alcance aprobado en la propuesta y lo amplía con controles de privacidad,
auditoría, multiinstitución, boletines académicos, pruebas E2E y mecanismos de seguridad para archivos
sensibles. La validación se apoya en pruebas funcionales automatizadas, revisión técnica de módulos y
matrices de trazabilidad. Como resultado, se obtuvo una plataforma web modular, responsive y preparada
para anexar documentación técnica, manuales y evidencias de funcionamiento.

**Palabras clave:** gestión escolar, seguridad escolar, aplicación web, NestJS, PostgreSQL, QR, NFC,
protección de datos.

## Abstract

Escuela Pass is a web application focused on school administration and safety in private educational
institutions. The project addresses needs related to access control, student pickup management,
family-school communication, attendance, grades, payments, reporting, and personal data protection.
The solution was implemented with a NestJS backend, PostgreSQL database, and React/Vite frontend,
integrating QR (Quick Response), NFC (Near Field Communication), JWT (JSON Web Token), maps,
notifications, and private file access.

The implementation preserves the approved proposal scope and extends it with privacy controls, audit
logging, multi-institution support, academic report cards, end-to-end tests, and security mechanisms
for sensitive documents. Validation is supported by automated functional tests, technical review of
modules, and traceability matrices. As a result, the project produced a modular and responsive web
platform supported by technical documentation, user manuals, API documentation, and testing evidence.

**Keywords:** school management, school safety, web application, NestJS, PostgreSQL, QR, NFC, data
protection.

## Introducción

Las instituciones educativas requieren herramientas que integren administración, seguridad y
comunicación en una sola plataforma. En muchos contextos, los procesos escolares se apoyan en registros
manuales, sistemas fragmentados o canales informales, lo que dificulta el control de accesos, la
comunicación con familias y el seguimiento académico. Esta situación resulta especialmente sensible
cuando se administran datos de menores de edad, información de ubicación, registros de asistencia,
calificaciones y comprobantes de pago.

Escuela Pass surge como una solución web para AlfaNetworks con el propósito de centralizar procesos
operativos y fortalecer la seguridad escolar. El sistema permite administrar usuarios y roles,
registrar accesos mediante QR/NFC, gestionar el circuito de recogida operado por padres o tutores,
registrar asistencia y calificaciones, emitir boletines, administrar pagos y presentar reportes
institucionales.

El documento se organiza en capítulos alineados con los objetivos específicos: presentación del
problema, diseño metodológico, marco referencial, análisis y diseño, construcción del sistema,
validación y cierre. Los detalles extensos, como requerimientos, diagramas, manuales, documentación API
y pruebas, se incluyen como anexos para respetar el límite máximo de 50 páginas del cuerpo principal.

# 1. PRESENTACIÓN DEL TRABAJO

## 1.1 Planteamiento Del Problema

La gestión escolar tradicional basada en procesos manuales y sistemas no integrados limita la capacidad
de las instituciones para responder a necesidades de seguridad, eficiencia y trazabilidad. El control
de entradas y salidas, la entrega de estudiantes, la comunicación con padres, la administración de
pagos y el seguimiento académico suelen depender de documentos físicos, hojas de cálculo o canales
separados. Esto produce duplicidad de información, retrasos y mayor exposición de datos sensibles.

En el contexto de Escuela Pass, el problema central se expresa como la insuficiencia de procesos
manuales y herramientas fragmentadas para administrar de forma segura y eficiente la operación escolar,
especialmente en escenarios que involucran menores de edad, control de accesos, recogida de estudiantes
y protección de información personal.

### 1.1.1 Causas Y Consecuencias

| Causa | Consecuencia directa |
| --- | --- |
| Uso de sistemas separados para administración, comunicación y seguridad. | Duplicidad de información, pérdida de trazabilidad y mayor esfuerzo operativo. |
| Registro manual de asistencia, accesos y pagos. | Mayor probabilidad de errores, demoras y dificultad para generar reportes confiables. |
| Falta de integración de QR, NFC y geolocalización. | Control de acceso y recogida menos eficiente, con menor visibilidad para familias e institución. |
| Circuito de recogida no digitalizado. | Congestión, incertidumbre de padres y tiempos de espera prolongados. |
| Ausencia de controles técnicos sobre archivos y datos sensibles. | Riesgo de acceso indebido a comprobantes, reportes, información académica o datos de menores. |
| Comunicación institucional dispersa. | Retrasos en avisos, notificaciones y seguimiento de solicitudes. |

## 1.2 Justificación

El desarrollo de Escuela Pass se justifica por su aporte tecnológico, social, académico y operativo.
Desde el punto de vista tecnológico, la plataforma aplica una arquitectura web moderna basada en
NestJS, PostgreSQL y React, con separación cliente-servidor, roles, validación de datos y servicios
complementarios. Desde el punto de vista social, fortalece la seguridad de estudiantes y la tranquilidad
de las familias al integrar control de accesos, circuito de recogida y notificaciones. Desde el punto
de vista académico, permite aplicar competencias de ingeniería informática en un proyecto real con
requerimientos funcionales, no funcionales, pruebas y documentación.

El proyecto también aporta a la protección de datos personales al incorporar autenticación, autorización
por rol, privacidad, auditoría y control de archivos sensibles. Estas decisiones son relevantes porque
el sistema trata información de menores, familias, docentes y personal administrativo.

## 1.3 Objetivos

### 1.3.1 Objetivo General

Desarrollar una aplicación web integral para AlfaNetworks orientada a la administración y seguridad
escolar en instituciones educativas privadas, mediante NestJS, PostgreSQL, tecnologías QR/NFC y una
interfaz web responsive, con el fin de optimizar procesos operativos, fortalecer la seguridad
estudiantil y proteger datos personales.

### 1.3.2 Objetivos Específicos

1. Analizar los requerimientos funcionales y no funcionales del sistema con base en la propuesta
   aceptada, las necesidades de AlfaNetworks y la evidencia técnica del repositorio.
2. Diseñar la arquitectura del sistema, el modelo de base de datos relacional y las interfaces de
   usuario aplicando principios de modularidad, seguridad y diseño responsive.
3. Implementar el backend con NestJS y PostgreSQL para autenticación, accesos QR/NFC, gestión escolar,
   circuito de recogida, pagos, reportes y módulos complementarios.
4. Desarrollar el frontend web con React/Vite para los perfiles administrador, administrativo, docente,
   padre/tutor y alumno.
5. Validar el funcionamiento mediante pruebas funcionales, E2E, smoke tests, revisión de seguridad y
   documentación de métricas.

## 1.4 Alcance

El alcance incluye una aplicación web responsive con autenticación por roles, control de acceso QR/NFC,
circuito de recogida operado por padres o tutores, gestión escolar, asistencia, calificaciones,
boletines, pagos con comprobante manual, avisos, notificaciones, dashboards, reportes, privacidad y
auditoría. No incluye aplicaciones móviles nativas, pasarela automática de pagos, reconocimiento facial,
soporte multiidioma ni analítica avanzada con inteligencia artificial.

# 2. DISEÑO METODOLÓGICO

El proyecto se desarrolló bajo un enfoque aplicado, con fases asociadas a los objetivos específicos.
Se adoptó una organización incremental, donde el análisis alimentó el diseño, el diseño guio la
implementación y las pruebas permitieron ajustar reglas de negocio, seguridad y documentación.
La metodología combinó revisión documental, análisis del repositorio, levantamiento de requerimientos
desde la propuesta aceptada, construcción incremental de módulos, pruebas funcionales automatizadas y
elaboración de anexos técnicos. Este enfoque permitió mantener trazabilidad entre lo propuesto, lo
implementado y lo documentado.

| Fase | Objetivo asociado | Actividades principales | Resultado |
| --- | --- | --- | --- |
| Análisis | Objetivo 1 | Revisión de propuesta, actores, RF/RNF y alcance. | Documento de requerimientos y matriz de trazabilidad. |
| Diseño | Objetivo 2 | Arquitectura, base de datos, rutas y prototipos. | Documentos de arquitectura, ER, UML y UI/UX. |
| Backend | Objetivo 3 | Módulos NestJS, entidades, servicios, controladores y pruebas. | API funcional y documentada. |
| Frontend | Objetivo 4 | Rutas, páginas por rol, componentes y flujos. | SPA responsive integrada con API. |
| Validación | Objetivo 5 | E2E, smoke, revisión de seguridad y documentación. | Informe de pruebas y métricas. |

![Figura. Cronograma tipo Gantt reconstruido para el TDG (exportado desde Mermaid)](docs/diagramas-mermaid-png/png/06-cronograma-gantt.png)

Tabla 2  
*Cronograma general del proyecto*

| Fase | Semana 1 | Semana 2 | Semana 3 | Semana 4 | Semana 5 | Semana 6 | Semana 7 | Semana 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Análisis | X | X |  |  |  |  |  |  |
| Diseño |  | X | X |  |  |  |  |  |
| Backend |  |  | X | X | X |  |  |  |
| Frontend |  |  |  | X | X | X |  |  |
| Pruebas |  |  |  |  | X | X | X |  |
| Documentación |  |  |  |  |  | X | X | X |

Nota. Cronograma reconstruido para el documento académico a partir de las fases de desarrollo y
validación del proyecto.

# 3. MARCO REFERENCIAL

## 3.1 Marco Conceptual

Una aplicación web es un sistema accesible desde navegador que permite centralizar lógica de negocio,
interacción de usuario y comunicación con servicios backend. En Escuela Pass, esta aproximación evita
instalar aplicaciones nativas y permite acceso desde dispositivos móviles o de escritorio.

NestJS es un framework backend para Node.js basado en TypeScript y arquitectura modular, orientado a
construir aplicaciones del lado servidor mantenibles y escalables (NestJS, s. f.). PostgreSQL es un
sistema de gestión de bases de datos relacional que permite integridad referencial, transacciones y
consultas estructuradas (PostgreSQL Global Development Group, s. f.). React permite construir interfaces
dinámicas mediante componentes reutilizables (Meta Open Source, s. f.), mientras Vite optimiza el
desarrollo y compilación frontend (Vite, s. f.). Estas herramientas se articulan para construir una
solución escalable, mantenible y documentable.

QR y NFC se utilizan para identificar usuarios o credenciales de acceso. GPS se emplea como apoyo al
circuito de recogida, entendiendo que la aplicación web móvil es usada por el padre o tutor que recoge
al estudiante. JWT permite proteger rutas mediante tokens estandarizados (Jones et al., 2015), y los
roles restringen operaciones según responsabilidad institucional.

## 3.2 Marco Legal

El sistema maneja datos personales de estudiantes, padres, docentes y personal institucional, por lo
que el TDG considera principios de finalidad, consentimiento, confidencialidad, seguridad y acceso
restringido. Dado que la propuesta aceptada ubica la solución inicialmente en instituciones privadas
de México, el marco legal de protección de datos debe contemplar la Ley Federal de Protección de Datos
Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, los cuales establecen obligaciones
para responsables privados en el tratamiento de datos personales (Cámara de Diputados del H. Congreso de
la Unión, 2010, 2011). Además, por tratarse de información relacionada con menores de edad, debe
considerarse la Ley General de los Derechos de Niñas, Niños y Adolescentes, especialmente en lo relativo
al interés superior de la niñez y la protección de su intimidad (Cámara de Diputados del H. Congreso de
la Unión, 2014).

En términos técnicos, estas exigencias se reflejan en autenticación, autorización por rol, aceptación de
políticas de privacidad, auditoría, control de archivos privados y minimización de exposición de datos.
Para una entrega institucional definitiva, esta sección debe ser revisada por el asesor o por una
persona competente en derecho aplicable, especialmente si el despliegue operativo se extiende a
Colombia u otros países.

## 3.3 Antecedentes

Los antecedentes del proyecto se ubican en tres líneas: transformación digital educativa, sistemas de
gestión escolar y seguridad/privacidad en aplicaciones web. La transformación digital en educación exige
que las soluciones no se limiten a reemplazar formularios físicos, sino que integren procesos, datos y
comunicación para apoyar decisiones institucionales. En esa línea, la UNESCO ha señalado la necesidad
de que la tecnología educativa se implemente con sentido pedagógico, protección de derechos y atención
a brechas digitales (UNESCO, 2023).

En gestión escolar, las plataformas integrales permiten reunir asistencia, comunicación, reportes y
administración en un solo entorno. La propuesta aceptada identifica este valor al comparar necesidades
de instituciones educativas con herramientas existentes de comunicación y control escolar. Escuela Pass
recoge esa orientación, pero la aterriza en una arquitectura propia que combina módulos académicos,
seguridad física y operación administrativa.

En seguridad de aplicaciones web, OWASP (2021) resalta riesgos como control de acceso roto,
fallos criptográficos, inyección y errores de configuración. Estos antecedentes técnicos justifican
decisiones como validación global de DTO, uso de JWT, roles, aislamiento por escuela, archivos privados
y auditoría. En consecuencia, la implementación no se limita a cumplir funciones visibles, sino que
incorpora controles necesarios para proteger información sensible.

## 3.4 Limitaciones

El proyecto se mantiene como una aplicación web responsive, sin aplicaciones móviles nativas. Tampoco
incluye pasarela automática de pagos, reconocimiento facial, soporte multiidioma ni analítica avanzada
con inteligencia artificial. La medición de usabilidad con usuarios piloto y los tiempos de respuesta
en ambiente productivo deben completarse como validación adicional si la institución lo requiere.

## 3.5 Alcance Del Marco Referencial

El marco referencial se enfoca en los conceptos y normas que explican la solución implementada:
aplicaciones web, arquitectura modular, bases de datos relacionales, autenticación, autorización,
QR/NFC, geolocalización, protección de datos y seguridad de aplicaciones. El detalle de módulos,
endpoints y manuales se ubica en anexos para no sobrecargar el documento principal.

# 4. ANÁLISIS Y DISEÑO DEL SISTEMA

El análisis identificó cinco actores principales: administrador de plataforma, personal administrativo,
docente, padre/tutor y alumno. Cada actor posee permisos diferenciados y acceso a módulos específicos.
El diseño técnico separa responsabilidades entre frontend, API, base de datos e integraciones externas.

La arquitectura sigue una estructura modular en NestJS. Cada dominio agrupa controladores, servicios,
DTOs, entidades y reglas de autorización. El frontend organiza rutas protegidas bajo `/app`, con menú
por rol, componentes reutilizables, manejo de notificaciones, mapas, formularios y pantallas
responsive.

![Figura. Arquitectura lógica cliente-servicio e integraciones](docs/diagramas-mermaid-png/png/02-arquitectura-despliegue-td.png)

El modelo de datos se organiza alrededor de escuelas, usuarios, grupos, estudiantes, padres, docentes,
asistencias, actividades, pagos, circuito, notificaciones, privacidad y auditoría. Esta organización
permite sostener el alcance multiinstitución y controlar acceso por relaciones institucionales.

# 5. CONSTRUCCIÓN DEL SISTEMA

## 5.1 Backend

El backend implementa módulos de autenticación, accesos, circuito, gestión escolar, asistencia,
actividades, boletines, pagos, reportes, archivos, privacidad y auditoría. La API utiliza DTOs y
validación global para controlar datos de entrada. Los servicios aplican reglas de negocio y TypeORM
gestiona la persistencia en PostgreSQL.

En autenticación se implementan login, refresh, logout, recuperación de contraseña y consulta de
perfil. El control por roles se complementa con validaciones de escuela, relación padre-estudiante,
asignación docente y estado de ciclo de vida. Esto permite que los permisos no dependan solo del rol,
sino también del contexto institucional.

## 5.2 Frontend

El frontend se construyó como SPA con React/Vite. La navegación se adapta a roles y las rutas críticas
están protegidas. Las pantallas principales cubren login, perfil, dashboard, escáner QR/NFC, circuito,
gestión escolar, finanzas, calificaciones, boletines, horarios, visitas, reuniones y administración.

La interfaz prioriza uso móvil para padres o tutores, especialmente en el circuito de recogida, y uso
de escritorio para administración y docentes. Se incorporan componentes de carga, error boundary,
confirmaciones, modales, selectores y soporte visual para modo oscuro.

## 5.3 Circuito De Recogida

El circuito permite que un padre o tutor autorizado cree una solicitud de recogida para un estudiante.
El sistema valida relación familiar, estado del estudiante, asistencia del día y configuración
institucional. El personal escolar visualiza solicitudes y actualiza estados operativos. La ubicación
GPS se usa como apoyo informativo y también puede activar la transición a `NOTIFICADO_LLEGADA` cuando
el padre entra al radio configurado; aun así, las autorizaciones institucionales, la salida del menor
y la confirmación de entrega se conservan como acciones explícitas y trazables.

## 5.4 Pagos Y Archivos Sensibles

El sistema administra conceptos, deudas y comprobantes. Los padres cargan comprobantes manualmente y
el personal administrativo verifica o rechaza. Los archivos sensibles se sirven por endpoints
autenticados, con validación de permisos, relación padre-estudiante o escuela, evitando exposición
pública indiscriminada.

# 6. VALIDACIÓN Y RESULTADOS

La validación se apoya en pruebas E2E que cubren flujos críticos: autenticación, asistencia, acceso
QR/NFC, circuito, pagos, reportes, exportaciones, privacidad, archivos privados y lifecycle. La suite
`test/app.e2e-spec.ts` cubre operación general, mientras `test/phase7-closure.e2e-spec.ts` valida
escenarios cruzados de seguridad y cierre. El test de throttle IP se ejecuta de forma separada por
requerir configuración estricta.

Los resultados muestran que el proyecto cumple los requerimientos principales y amplía el alcance con
funcionalidades que fortalecen seguridad, trazabilidad y operación institucional. Las métricas de
usabilidad y satisfacción deben levantarse con usuarios piloto si la institución lo requiere.

[Imagen: Resultado final de pruebas E2E — insertar captura de consola de npm run test:e2e o reporte CI]

# 7. CONCLUSIONES

El desarrollo de Escuela Pass permitió consolidar una solución web modular para procesos escolares que
tradicionalmente se gestionan de forma fragmentada. El análisis de requerimientos permitió ordenar el
alcance aprobado y precisar aspectos relevantes, como la interpretación del circuito de recogida como
un flujo operado por padres o tutores desde su propio dispositivo móvil.

El diseño de arquitectura y base de datos permitió estructurar el sistema por dominios, separar
responsabilidades y sostener reglas de seguridad multiinstitución. La decisión de usar NestJS,
PostgreSQL y React/Vite facilitó una implementación mantenible y alineada con prácticas modernas de
desarrollo web.

La implementación del backend y frontend logró cubrir los módulos centrales de autenticación, accesos,
circuito, gestión escolar, académico, pagos, comunicación y reportes. Además, se incorporaron mejoras
no previstas inicialmente, como privacidad, auditoría, archivos privados, lifecycle y pruebas E2E,
que fortalecen la calidad del producto sin alterar el propósito original de la propuesta.

La validación mediante pruebas automatizadas y documentación de anexos permite defender el cumplimiento
del proyecto con evidencia trazable. No obstante, se recomienda complementar el cierre con pruebas de
usabilidad o satisfacción en usuarios piloto para respaldar con datos la experiencia de uso.

# 8. RECOMENDACIONES Y TRABAJOS FUTUROS

Se recomienda ejecutar una prueba piloto institucional con usuarios reales, medir tiempos de respuesta
en ambiente productivo, levantar encuesta de satisfacción, fortalecer CI con build/lint frontend y
definir formalmente la licencia del proyecto.

Como trabajos futuros se propone evaluar una aplicación móvil nativa si la operación institucional lo
exige, integrar pasarelas de pago, ampliar analítica operativa, fortalecer observabilidad y formalizar
políticas de retención de datos según asesoría legal.

# 9. LICENCIA

## 9.1 Estado

[Licencia pendiente por definir]

## 9.2 Nota Para Revisión

La licencia debe definirse considerando los derechos de la universidad, AlfaNetworks y el interés del
autor en conservar capacidad de modificación y comercialización. Esta sección debe revisarse con
asesoría jurídica antes de entrega final.

# Referencias

Cámara de Diputados del H. Congreso de la Unión. (2010). *Ley Federal de Protección de Datos Personales en Posesión de los Particulares*. https://www.diputados.gob.mx/

Cámara de Diputados del H. Congreso de la Unión. (2011). *Reglamento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares*. https://www.diputados.gob.mx/

Cámara de Diputados del H. Congreso de la Unión. (2014). *Ley General de los Derechos de Niñas, Niños y Adolescentes*. https://www.diputados.gob.mx/

Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)* (RFC 7519). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc7519

Meta Open Source. (s. f.). *React*. https://react.dev/

NestJS. (s. f.). *Documentation*. https://docs.nestjs.com/

OWASP Foundation. (2021). *OWASP Top 10: The ten most critical web application security risks*. https://owasp.org/www-project-top-ten/

PostgreSQL Global Development Group. (s. f.). *PostgreSQL documentation*. https://www.postgresql.org/docs/

UNESCO. (2023). *Global education monitoring report 2023: Technology in education*. https://www.unesco.org/gem-report/

Vite. (s. f.). *Vite documentation*. https://vite.dev/

# Anexos

- Anexo 1. Matriz de trazabilidad.
- Anexo 2. Documento de requerimientos.
- Anexo 3. Actas de reuniones.
- Anexo 4. Documento de arquitectura.
- Anexo 5. Modelo entidad-relación.
- Anexo 6. Diagramas UML.
- Anexo 7. Prototipos UI/UX.
- Anexo 8. Manual técnico.
- Anexo 9. Documentación API.
- Anexo 10. Manual de usuario.
- Anexo 11. Informe de pruebas y métricas.
- Anexo 12. Nota de verificación documental.
