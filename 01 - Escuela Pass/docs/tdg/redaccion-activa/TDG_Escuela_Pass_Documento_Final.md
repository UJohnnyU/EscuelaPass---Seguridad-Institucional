# ESCUELA PASS — ADMINISTRACIÓN Y SEGURIDAD ESCOLAR

## TRABAJO DE GRADO

**Modalidad:** Ingeniería Informática  
**Área curricular:** Programas Informáticos y Telecomunicaciones (APIT)  
**Facultad de Ingenierías**  
**Politécnico Colombiano Jaime Isaza Cadavid**  
**Medellín, 2026**

**Autor:** Jhon Kevin Murillo Martínez  
**Asesor:** Alirio Antonio Gutiérrez Quintero  
**Empresa vinculada al caso de estudio:** AlfaNetworks  

---

**[Figura 1. Portada del trabajo de grado según instructivo del Área APIT y plantilla institucional.]**

**[Figura 2. Contraportada del trabajo de grado según instructivo del Área APIT y plantilla institucional.]**

---

## DEDICATORIA Y AGRADECIMIENTOS

*Apartados opcionales conforme al instructivo del programa; se incorporan en la versión impresa definitiva.*

---

## TABLA DE CONTENIDO

*Generar en Microsoft Word mediante estilos de título y referencias cruzadas.*

1. Resumen  
2. Abstract  
3. Introducción  
4. Planteamiento del problema  
5. Justificación  
6. Objetivos  
7. Diseño metodológico  
8. Marco referencial  
9. Alcance  
10. Desarrollo del trabajo de grado  
11. Conclusiones  
12. Recomendaciones y trabajos futuros  
13. Referencias  
14. Lista de figuras y tablas  
15. Índice de anexos  

---

## RESUMEN

Las instituciones educativas privadas en México articulan seguridad física, tratamiento de datos sensibles —particularmente de niñas, niños y adolescentes— y administración escolar bajo presión creciente por digitalización y cumplimiento normativo (UNESCO, 2024). La fragmentación entre herramientas dispersas dificulta auditoría, coordinación con familias y gobernanza de datos personales alineada con la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares** (LFPDPPP) y los lineamientos del **Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales** (INAI) (Cámara de Diputados, 2010; INAI, s. f.).

Este trabajo de grado desarrolla **Escuela Pass**, aplicación web propuesta por **AlfaNetworks** con arquitectura modular sobre **NestJS** (NestJS Team, s. f.) y **PostgreSQL** (PostgreSQL Global Development Group, s. f.), cliente **React** (React Team, s. f.) empaquetado con **Vite** (Vite Team, s. f.), control de acceso mediante códigos **QR** (Quick Response) y comunicación **NFC** (Near Field Communication), y un circuito de recogida familiar con apoyo de **GPS** (Global Positioning System). La plataforma integra identidad, control de accesos, gestión escolar, comunicación institucional y cartera con revisión humana de comprobantes —sin pasarela bancaria automática en el alcance documentado—. El objetivo general aprobado en la **Ficha de Trabajo de Grado** (FTG) se atiende íntegramente, y la pregunta de investigación literal orienta la argumentación a lo largo del documento.

En síntesis metodológica, se aplicó un proceso iterativo e incremental sobre el marco **Scrum** (Schwaber & Sutherland, 2020) con cinco fases alineadas a los cinco objetivos específicos aprobados (análisis de requerimientos; diseño; implementación del servicio; desarrollo del cliente; validación). Los resultados muestran un producto coherente con los requerimientos funcionales y no funcionales acordados, con limitaciones explícitas que el documento reconoce honestamente: almacenamiento de credenciales de sesión en el navegador, cobertura de pruebas sesgada hacia pruebas extremo a extremo, y métricas de desempeño y usabilidad sujetas a medición posterior con usuarios piloto mediante la **System Usability Scale** (SUS) (Brooke, 1996). Se concluye que la propuesta contribuye a optimizar procesos operativos e instrumenta controles de privacidad y seguridad acordes a un despliegue responsable en el contexto mexicano, sin sustituir políticas institucionales ni asesoría jurídica externa.

**Palabras clave:** seguridad escolar; protección de datos personales; circuito de recogida familiar; códigos QR; comunicación NFC; aplicación web; NestJS; PostgreSQL; React; instituciones educativas privadas; México.

---

## ABSTRACT

Escuela Pass is a web platform for institutional school administration and physical security, aimed at private educational settings in Mexico where personal data protection standards must be observed. Built with NestJS, PostgreSQL, an object‑relational mapper, and a React/Vite client, it combines token‑based role access, QR and NFC physical access, a family pickup workflow with optional geolocation support, academic and administrative modules, institutional communication, and fee management with manual review of payment evidence (no automatic payment gateway in scope). Functional and non‑functional requirements are traced in annexed matrices and validated through reproducible end‑to‑end backend tests and documented continuous integration. Residual limitations include browser token storage, a test pyramid skewed toward end‑to‑end tests, and the need for measured performance and usability evidence. The project is positioned as an engineering response to the formal thesis research question concerning scalable architecture and regulatory alignment for personal data in the Mexican institutional context.

**Keywords:** school safety; personal data protection; pickup circuit; QR/NFC; NestJS; PostgreSQL; private schools; Mexico.

---

## 1. INTRODUCCIÓN

Las instituciones educativas gestionan en paralelo formación, convivencia, seguridad en el plantel y relación con familias que demandan información oportuna por canales confiables. La digitalización puede concentrar parte de esa complejidad si se respetan límites legales y pedagógicos: tratamiento de datos personales, especialmente de menores; proporcionalidad de la recolección; y separación entre lo que el software automatiza y lo que permanece como decisión humana de la institución (UNESCO, 2024). El **Consejo Nacional de Evaluación de la Política de Desarrollo Social** (CONEVAL, 2024) y el **Ministerio de Educación Nacional de Colombia** (MEN, 2024) documentan brechas digitales y márgenes de mejora en transparencia y acceso a la información que justifican plataformas integrales para el sector privado mexicano y, por extensión, para Latinoamérica (MetaRed, 2024).

**Escuela Pass** se presenta como producto de trabajo de grado desarrollado con **AlfaNetworks**. Integra un servicio web construido con **NestJS** (NestJS Team, s. f.) y **TypeScript** sobre **PostgreSQL** (PostgreSQL Global Development Group, s. f.) —gestionada mediante un **ORM** (Object-Relational Mapper) (Elmasri & Navathe, 2016)—, y un cliente web con **React** (React Team, s. f.), **Vite** (Vite Team, s. f.) y estilos responsivos, en configuración compatible con despliegue sobre infraestructura tipo **PaaS** (Platform as a Service) para el servicio y la base de datos, y alojamiento estático para el cliente. Los dominios —identidad, acceso físico, circuito familiar, nómina, finanzas escolares, comunicación y analítica— se organizan en módulos cohesionados expuestos a través de una interfaz **HTTP** (Hypertext Transfer Protocol) versionada por configuración, siguiendo el estilo arquitectónico **REST** (Representational State Transfer) propuesto por Fielding (2000).

El cuerpo del documento articula el qué y el porqué académico; los anexos numerados concentran inventarios técnicos (catálogo de operaciones HTTP, modelo relacional, diagramas, manuales y plan de pruebas). Esta división atiende la extensión máxima del texto principal y permite contrastar afirmaciones con evidencia tabular sin transcribir cada operación REST en el capítulo central.

La línea argumental reconoce un **alcance ampliado** respecto del texto mínimo histórico de la propuesta —multiinstitución, visitas, reuniones, anotaciones, privacidad y auditoría—. Esas capacidades complementan los requerimientos funcionales y no funcionales aprobados sin sustituirlos, y se tabulan de forma consistente en los anexos del trabajo.

### 1.1. Contribución documental y técnica

La contribución combina **(a)** especificación trazable de requerimientos institucionales en línea con la práctica recomendada por la **IEEE Std 830-1998** (IEEE, 1998), **(b)** arquitectura modular acorde a dominios escolares y **(c)** evidencia de validación reproducible mediante compilación, pruebas extremo a extremo (E2E, *end-to-end*) con PostgreSQL e **integración continua** (CI, Continuous Integration) en el repositorio (GitHub, s. f.). Desde ingeniería de software (Pressman & Maxim, 2020), el producto contextualiza patrones habituales —**JWT** (JSON Web Token; IETF, 2015), validación declarativa, ORM, tareas programadas y auditoría— en un dominio donde la población incluye menores y la trazabilidad de actos sensibles forma parte del valor entregado.

### 1.2. Organización del documento

El documento se estructura en cinco capítulos: el primero presenta el planteamiento del problema, la justificación por impactos y los objetivos; el segundo desarrolla el diseño metodológico apoyado en el marco **Scrum** (Schwaber & Sutherland, 2020); el tercero ofrece el marco referencial y el alcance; el cuarto detalla el desarrollo del trabajo por objetivo específico; el quinto consolida los resultados y la discusión frente a la pregunta de investigación. Cierran las conclusiones alineadas a los objetivos específicos, las recomendaciones y trabajos futuros, la licencia del proyecto, las referencias en formato APA séptima edición, las listas de figuras y tablas, el glosario consolidado de acrónimos y el índice de anexos.

---

## 2. PLANTEAMIENTO DEL PROBLEMA

### 2.1. Contexto

En instituciones educativas privadas en México, la expectativa de calidad y transparencia convive con obligaciones en materia de protección de datos personales y con la necesidad de protocolos claros de seguridad física en ingreso, permanencia y salida coordinada con familias. La situación de la región muestra brechas digitales relevantes: el CONEVAL (2024) reporta limitaciones de conectividad en escuelas públicas mexicanas y, según el MEN (2024), persisten márgenes de mejora en transparencia institucional. En transporte escolar y movilidad familiar, OnTrack School (2024) documenta tiempos promedio de ruta superiores a una hora en zonas urbanas, con picos de hasta 3 horas 30 minutos en días atípicos, lo que tensiona la coordinación de salidas. Cuando procesos críticos dependen de canales informales o de archivos no integrados, crecen errores operativos, demoras informativas y dificultad para reconstruir hechos ante incidentes o reclamos, además de tensiones con el cumplimiento de los principios de licitud, información y responsabilidad establecidos en la LFPDPPP (Cámara de Diputados, 2010).

### 2.2. Identificación del PIN (Problema, Idea o Necesidad)

**Problema:** fragmentación operativa entre control de acceso al plantel, coordinación de salida con familias, gestión académico–administrativa y comunicación institucional, con riesgos de gobernanza débil sobre datos personales sensibles, particularmente cuando la población titular incluye niñas, niños y adolescentes.

**Idea / necesidad:** disponer de una aplicación web integrada, desarrollada con AlfaNetworks, basada en arquitecturas escalables (NestJS, PostgreSQL), credenciales QR y NFC, y trazabilidad documental, que permita optimizar esos procesos y alinear prácticas con los estándares normativos de protección de datos personales aplicables al caso (Cámara de Diputados, 2010; INAI, s. f.). Plataformas comerciales como Skolable (2026) y revisiones del sector como Santhosh (2025) y Manciu (2025) muestran la conveniencia de integrar control de accesos, comunicación familiar y gestión de salidas en una sola aplicación, motivo por el cual se propone una solución que retoma esos principios y los adapta al alcance acordado con la empresa.

### 2.3. Análisis del problema

Dos vectores explican la persistencia del problema. **Operativamente**, la ausencia de un núcleo único de políticas y registros —identidad, accesos, circuito, académico–financiero— favorece duplicidad de datos y lagunas de auditoría. **Normativamente**, el tratamiento de datos de estudiantes y familias exige mecanismos de transparencia, minimización y control de acceso; un sistema que sólo resuelva pantallas sin gobernanza documentada reproduce riesgos de incumplimiento reputacional y legal, bajo asesoría institucional correspondiente (Cámara de Diputados, 2010).

Escuela Pass plantea una plataforma única con autorización coherente en servidor y trazas persistidas. No sustituye el criterio pedagógico ni la interpretación jurídica definitiva; instrumenta protocolos definidos por la institución y declara límites operativos —cobros sin pasarela bancaria automática, degradación controlada de servicios externos opcionales como notificaciones, mapas o correo cuando faltan credenciales— sin atribuirse capacidades que no entrega.

### 2.4. Formulación del problema — pregunta de investigación

La pregunta que orienta el trabajo de grado, en los términos aprobados en la propuesta, es la siguiente:

> ¿Cómo el desarrollo de una aplicación web de AlfaNetworks basada en arquitecturas escalables con NestJS, PostgreSQL, tecnologías NFC y QR puede optimizar los procesos de seguridad física, protección de datos sensibles y administración escolar en instituciones educativas privadas de México, cumpliendo con los estándares normativos de protección de datos personales?

**Tabla 1. Problemática: causas y consecuencias**

| Causa | Consecuencia |
| --- | --- |
| Dispersión de registros y canales (hojas de cálculo, mensajería informal, sistemas inconexos). | Errores humanos, demoras, dificultad de auditoría y reconstrucción de hechos. |
| Control de acceso basado sólo en credenciales frágiles o procedimientos no correlacionados con identidad digital. | Mayor riesgo de incidentes en portería y disputas con familias. |
| Tratamiento de datos personales sin flujos explícitos de consentimiento, minimización y trazabilidad institucional. | Riesgos de incumplimiento normativo (México) y pérdida de confianza de familias. |
| Desalineación entre operación diaria (salidas, comunicación, cartera) y evidencia digital homogénea. | Sobrecarga administrativa, reclamos y opacidad frente a supervisiones internas. |

### 2.5. Alcances excluidos o diferidos (síntesis)

Quedan fuera del núcleo problemático central, salvo notas en anexos: pasarelas bancarias automáticas, biometría de alta seguridad en torniquetes, análisis forense avanzado de dispositivos y certificación formal de centros de datos. La interpretación legal definitiva sobre tratamiento transfronterizo o normativa sectorial específica corresponde a la institución y asesoría jurídica, no al software aisladamente.

---

## 3. JUSTIFICACIÓN

La digitalización responsable de procesos escolares en México converge en la necesidad de plataformas que integren seguridad física, administración y protección de datos personales sin fragmentar las fuentes de verdad. **Escuela Pass** aporta, en el contexto de su empresa vinculada **AlfaNetworks**, una implementación trazable y un paquete documental que permite evaluar esa convergencia en un caso real, y un ciclo de trabajo iterativo e incremental coherente con tiempo finito de grado. La justificación se desagrega a continuación por tipos de impacto.

### 3.1. Impacto social

Una mejor coordinación entre institución y familias contribuye al bienestar percibido tanto de estudiantes como de adultos responsables: visibilidad ordenada de salidas, autorizaciones explícitas y comunicación institucional reemplazan canales informales donde la privacidad de menores puede verse afectada por difusión accidental (UNESCO, 2024). El proyecto no resuelve la dimensión humana del cuidado, pero dota a la institución de un canal único con permisos granulares y registros consultables, especialmente útil en contextos urbanos donde el tráfico vespertino y la coordinación familiar generan tiempos extensos de espera (OnTrack School, 2024).

### 3.2. Impacto tecnológico

El trabajo demuestra la viabilidad de integrar identidad, acceso físico mediante credenciales QR y NFC, circuito familiar geolocalizado, operación académico–administrativa, comunicación y cartera en una sola plataforma con servicios web y base de datos relacional, en una arquitectura modular que admite crecimiento sin reescribir el núcleo. Sirve además como referencia educativa de cómo combinar NestJS (NestJS Team, s. f.), PostgreSQL (PostgreSQL Global Development Group, s. f.), React (React Team, s. f.) y herramientas de identificación física en un sector regulado, con pruebas automatizadas y despliegue reproducible en plataformas como servicio (GitHub, s. f.). El estilo arquitectónico REST adoptado para la interfaz HTTP se inspira en Fielding (2000) y se documenta de forma viva mediante la **OpenAPI Specification** versión 3.1.0 (OpenAPI Initiative, 2021).

### 3.3. Impacto económico

La digitalización de bitácoras repetitivas —asistencias, exportaciones de boletines y conciliación de comprobantes— reduce horas de plantilla administrativa y errores de transcripción, en línea con lo observado por el sector en estudios de madurez digital institucional (MetaRed, 2024; Santhosh, 2025). La cuantificación monetaria de ese ahorro requiere muestra longitudinal que el presente proyecto no ejecuta como estudio estadístico de campo. Se entrega, en cambio, un producto y una trazabilidad documental que habilitan estudios económicos posteriores en una institución piloto, sin sustituir esa medición.

### 3.4. Impacto académico

Para la formación del estudiante de Ingeniería Informática, el trabajo articula competencias de modelado relacional (Codd, 1970; Elmasri & Navathe, 2016), ingeniería de requisitos según la práctica recomendada de la IEEE Std 830-1998 (IEEE, 1998), diseño de arquitecturas web modulares (Pressman & Maxim, 2020), seguridad pragmática a nivel de aplicación según el OWASP Top 10 (OWASP Foundation, 2021), integración continua y documentación versionada. Se trata de un caso completo —no un fragmento— en el que cada decisión técnica se expone con justificación, *trade-offs* y limitaciones honestas, y en el que las cifras públicamente verificables (cuarenta y nueve entidades del modelo, doscientas cuarenta y una operaciones HTTP del *backend*, cinco roles, cinco fases) permiten comprobación reproducible.

### 3.5. Impacto normativo

Las herramientas internas para versionar políticas, registrar aceptaciones con marca temporal y dejar bitácoras de auditoría dotan a la institución de evidencia técnica para acompañar el cumplimiento de la LFPDPPP (Cámara de Diputados, 2010) y los lineamientos del INAI aplicables (INAI, s. f.). El software no sustituye la asesoría jurídica ni la decisión institucional sobre el responsable del tratamiento; sí materializa los apoyos técnicos que un programa de cumplimiento razonable requiere para demostrar diligencia y transparencia ante familias, autoridades educativas y, eventualmente, autoridad competente.

---

## 4. OBJETIVOS

### 4.1. Objetivo general

Desarrollar una aplicación web integral de **AlfaNetworks** para la administración y seguridad escolar en instituciones educativas privadas de México, mediante la implementación de tecnologías **NestJS**, **PostgreSQL**, **JavaScript**, **NFC** y **QR**, que optimice los procesos operativos, fortalezca la seguridad estudiantil y garantice la protección de datos personales conforme a la normativa vigente.

### 4.2. Objetivos específicos

Los cinco objetivos específicos siguientes reproducen literalmente el planteo de la propuesta formal aprobada. Los anexos del trabajo desagregan entregables y evidencias bajo estos cinco objetivos.

1. Analizar los requerimientos funcionales y no funcionales del sistema mediante reuniones con los representantes de AlfaNetworks y estudio de campo en instituciones educativas, documentando las especificaciones técnicas que guiarán el desarrollo de la aplicación Escuela Pass.
2. Diseñar la arquitectura del sistema, el modelo de base de datos relacional y las interfaces de usuario aplicando principios de usabilidad y diseño responsive, garantizando una experiencia óptima en escritorio y dispositivos móviles.
3. Implementar el backend de la aplicación utilizando NestJS y PostgreSQL, desarrollando APIs REST para los módulos de autenticación, control de accesos NFC/QR, gestión escolar, circuito vial con integración GPS y administración de pagos.
4. Desarrollar el frontend de la aplicación con JavaScript moderno, implementando interfaces intuitivas para administradores, docentes, padres de familia y personal de seguridad, garantizando la correcta integración con los servicios backend.
5. Validar el funcionamiento del sistema mediante pruebas funcionales, de integración, de usabilidad con usuarios piloto y métricas de rendimiento, verificando el cumplimiento de los objetivos de eficiencia, seguridad y protección de datos establecidos.

---

## 5. DISEÑO METODOLÓGICO

### 5.1. Enfoque general

Se adoptó ingeniería de software iterativa e incremental, alineada con desarrollo de producto en contexto empresa–academia. El marco operativo de referencia fue **Scrum** (Schwaber & Sutherland, 2020; Drumond, 2026), apoyado en literatura general de ingeniería de software (Pressman & Maxim, 2020). Cada incremento cerraba *backlog* con trazabilidad entre requerimientos funcionales y no funcionales, actualización de migraciones cuando el modelo persistido cambiaba y extensión de pruebas extremo a extremo para flujos críticos de seguridad y consistencia académico–financiera, en línea con la **IEEE Std 829-2008** sobre documentación de pruebas (IEEE, 2008).

### 5.2. Fuentes de información y técnicas de verificación

Las **fuentes primarias** del trabajo son la propuesta formal aprobada —con su pregunta de investigación, objetivo general y objetivos específicos— y las sesiones de alineación con representantes de AlfaNetworks sobre prioridades funcionales y operativas. Las **fuentes técnicas** son el repositorio del proyecto, la documentación técnica versionada y la suite de pruebas automatizadas. Como **fuentes secundarias** se utilizaron la documentación oficial de los componentes de la pila tecnológica empleada (NestJS Team, s. f.; PostgreSQL Global Development Group, s. f.; React Team, s. f.; Vite Team, s. f.; TypeORM, s. f.), guías regulatorias mexicanas en materia de protección de datos personales (Cámara de Diputados, 2010; INAI, s. f.) y literatura especializada en ingeniería de software, seguridad de aplicaciones web (OWASP Foundation, 2021) y calidad (ISO, 2011). Las **técnicas de verificación** combinaron revisión de código, ejecución de suites automatizadas extremo a extremo con base de datos real, inspección del contrato HTTP en notación OpenAPI (OpenAPI Initiative, 2021) generado por el servicio, y consolidación documental de actas con la contraparte empresarial.

### 5.3. Fases del trabajo (por objetivo específico)

En cada fase, el **objetivo específico** se expresa como **resultado esperado** (sustantivo). Las actividades se enuncian como **sustantivos** de trabajo.

**Tabla 2.** Fases, actividades y resultados documentales, alineadas a los cinco objetivos específicos aprobados.

| Fase | Resultado esperado | Actividades principales (sustantivos) | Resultados documentales |
| --- | --- | --- | --- |
| I | Análisis de requerimientos | Entrevistas y acuerdos con la contraparte empresarial; consolidación de requerimientos funcionales y no funcionales; trazabilidad matricial; actas | Documentos de análisis, requerimientos y actas en los anexos correspondientes |
| II | Diseño del sistema (arquitectura, datos, interfaz) | Modelado arquitectónico; modelo entidad–relación; diagramas UML; prototipos de interfaz; bases del manual de usuario | Documento de arquitectura, modelo de datos, diagramas UML, prototipos UI/UX |
| III | Implementación del servicio backend | Diseño modular por dominios; persistencia parametrizada; contratos REST; documentación interactiva mediante OpenAPI | Servicio ejecutable, catálogo HTTP completo en anexo dedicado |
| IV | Desarrollo del cliente web | Aplicación de página única con React y Vite; rutas por rol; integración con el servicio | Cliente compilable y manual de usuario por rol |
| V | Validación y cierre técnico | Pruebas extremo a extremo; integración continua; planes de medición de desempeño y usabilidad; manual técnico y variables de despliegue | Informe de pruebas, manual técnico y bitácora de mediciones planificadas |

### 5.4. Tecnologías y herramientas (visión sintética)

Las tecnologías esenciales acordadas con la empresa y reproducibles desde el código son: **NestJS** y **TypeScript** para el servicio web; **PostgreSQL** con un mapeador objeto‑relacional para la persistencia; **React**, **TypeScript** y **Vite** para el cliente, complementados con utilidades de estilo responsivo. Como infraestructura auxiliar parametrizada se contemplaron servicios de mensajería de notificaciones, mapas y correo electrónico, con **degradación elegante** cuando faltan credenciales. El inventario granular de comandos de instalación, variables de entorno y procedimientos operativos se reserva al manual técnico anexo.

### 5.5. Decisiones técnicas adoptadas en la ejecución que no figuraban punto por punto en la propuesta inicial

La propuesta original abría preferencias y mantenía abiertos varios medios técnicos. Durante la ejecución se concretaron decisiones que **no alteran la pregunta de investigación ni los cinco objetivos específicos aprobados** y que se justifican siguiendo la **tríada motivo–problema–beneficio** recomendada por el asesor.

**(a) Despliegue.** Se descartó el alojamiento clásico tipo panel orientado a PHP y se adoptó una combinación habitual para productos con servicio Node.js: el servicio web ejecutándose de forma continua en una plataforma como servicio, base de datos relacional administrada por proveedor externo y cliente estático en CDN. *Por qué se adoptó:* la pila ejecutiva del proyecto difiere de los hospedajes PHP tradicionales y requiere un proceso vivo del servicio. *Problema resuelto:* fricciones operativas de despliegue académico y demostrabilidad institucional con secretos parametrizados. *Beneficio:* mayor probabilidad de un entorno de pruebas realista sin pedir infraestructura física al plantel cliente.

**(b) Geolocalización y mapas.** Se priorizó un proveedor de mapas con biblioteca lado cliente y se complementó con cálculo Haversine para distancias cuando faltan claves. *Problema resuelto:* incertidumbre de licenciamiento y costo acumulado en etapa académica. *Beneficio:* experiencia que **degrada con elegancia** ante ausencias de configuración, sin romper el circuito.

**(c) Bibliotecas de identificación QR.** La nomenclatura de biblioteca prevista en versiones tempranas de la propuesta podía diferir sin violar la función esperada (escaneo de cámara y generación de credencial en navegador). *Beneficio técnico:* cobertura más amplia de hardware móvil real heterogéneo del entorno escolar.

**(d) Modelo del actor que inicia el circuito.** Se explicitó que el padre o tutor responsable inicia y conduce la solicitud de salida, ante ambigüedad inicial entre transporte institucional y retiro parental predominante en contexto urbano mexicano. *Beneficio institucional:* reglas del servicio concordantes con la práctica empresa–cliente revisada posteriormente y consistencia operativa en portería.

**(e) Multi‑institución y módulos auxiliares.** Se incorporaron capacidades de operación multi‑escuela y dominios auxiliares (visitas, reuniones, anotaciones, privacidad y auditoría) que extienden el alcance ejecutado sin modificar los objetivos específicos. *Beneficio:* el producto puede demostrarse en una empresa que opera varias instituciones, fortaleciendo el caso académico de validación.

Cada una de estas decisiones se retoma en los capítulos 4 y 5 con la misma tríada cuando corresponde, y se concentra de forma tabular en el anexo de arquitectura.

### 5.6. Estructura del documento (representación gráfica)

*[Figura 3. Diagrama orientativo del orden del documento y su relación con los anexos. Recomendado: Lucidchart con asistencia de Lucid AI o exportación de un diagrama Mermaid a imagen.]*

### 5.7. Cronograma

El cronograma del proyecto —desde el 24/02/2026 hasta el 21/06/2026— se presenta como diagrama de Gantt elaborado con herramienta de gestión de proyectos.

*[Figura 4. Cronograma Gantt del proyecto Escuela Pass (24/02/2026–21/06/2026). Recomendado: Microsoft Planner, ClickUp u homólogo institucional; exportar imagen para Word.]*

---

## 6. MARCO REFERENCIAL

Los desarrollos instrumentales extensos (catálogo de operaciones HTTP, modelo relacional detallado y plan de pruebas) se amplían en los anexos del trabajo.

### 6.1. Marco conceptual

**Seguridad física y flujos escolares.** La seguridad combina procedimiento humano y tecnología. Las credenciales basadas en códigos QR y comunicación NFC reducen la dependencia de medios fácilmente falsificables, pero introducen riesgos de uso compartido de dispositivo; por ello la validez se ancla en el servidor, en los roles y en el contexto institucional, manteniendo el criterio humano como segundo factor de autoridad ante situaciones excepcionales (Stallings & Brown, 2018).

**Control de acceso QR y NFC.** El código bidimensional impreso o mostrado en pantalla y la lectura de proximidad por chip ofrecen formas estandarizadas de identificación rápida en portería, ya empleadas en transporte público y eventos masivos. La diferencia con esos contextos es el público objetivo —menores— y la sensibilidad de los registros, lo que exige decisiones explícitas sobre minimización, retención y acceso por rol (Cámara de Diputados, 2010).

**Sistemas de información institucionales.** Para Laudon y Laudon (2018), un sistema de información organizacional articula recolección, procesamiento, almacenamiento y distribución de datos para sostener la toma de decisiones. Escuela Pass adopta esa lectura aplicada al dominio escolar, donde la coherencia entre académico, financiero y de seguridad física es condición de auditoría.

**Arquitecturas web cliente–servidor.** Las aplicaciones de una sola página facilitan experiencias responsivas y despliegue estático del cliente. Parte de la superficie de seguridad, no obstante, recae en el navegador del usuario. La elección operativa de Escuela Pass de almacenar credenciales de sesión en el navegador implica un compromiso conocido frente a esquemas más estrictos basados en cookies de solo servidor: se documenta de manera transparente como deuda técnica, con líneas de mejora trazadas hacia trabajo futuro.

**API y documentación.** El estándar OpenAPI (OpenAPI Initiative, 2021) apoya la auditoría de contratos REST (Fielding, 2000). En entornos productivos la documentación interactiva permanece deshabilitada por defecto, salvo configuración explícita por parte de la institución que despliega.

**Ingeniería de requisitos multiactor.** El trabajo prioriza trazabilidad matricial entre requerimientos, dominios y evidencia para limitar la deriva entre la intención de negocio y el comportamiento desplegado, en coherencia con la práctica recomendada de la IEEE Std 830-1998 (IEEE, 1998). Las decisiones técnicas delicadas conservan fuente primaria en el código y en los anexos del trabajo, en coherencia con prácticas modernas de documentación versionada.

**Seguridad de aplicaciones.** Siguiendo las recomendaciones publicadas por la OWASP Foundation (2021) en su Top 10 de riesgos para aplicaciones web, se aplicaron medidas pragmáticas a nivel del servicio web: validación declarativa de entrada, limitación global de tasa de peticiones, cabeceras de seguridad por proxy del propio servicio, control de archivos privados y consultas parametrizadas mediante el mapeador objeto‑relacional. Persisten riesgos teóricos asociados a la persistencia de credenciales en el navegador; un modelo de amenazas simplificado tipo STRIDE —*spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege*— orienta lecturas críticas del diseño y se documenta con mayor detalle en los anexos correspondientes.

**Calidad de software.** Bajo la lectura de la ISO/IEC 25010 (ISO, 2011), los atributos de adecuación funcional, fiabilidad, seguridad, mantenibilidad y portabilidad se discuten con base en evidencias del repositorio. Los atributos de eficiencia de desempeño y usabilidad quedan sujetos a un plan de medición que el documento entrega en el anexo de pruebas, con instrumentos como la SUS (Brooke, 1996).

**Bases de datos relacionales.** El trabajo se apoya en el modelo relacional clásico (Codd, 1970) y en su tratamiento contemporáneo (Elmasri & Navathe, 2016) para fundamentar la integridad referencial, la normalización y la separación entre lógica de negocio y persistencia.

**Datos personales en menores y ética del dato escolar.** Más allá del cumplimiento estricto, cada pantalla debe justificar finalidad y proporcionalidad. La presencia de menores como personas titulares hace que las decisiones de minimización y de control de audiencia adquieran un peso ético mayor. La aplicación instrumenta políticas versionadas y registros de aceptación; el texto jurídico y su armonización con la LFPDPPP son responsabilidad de la institución y de su asesoría (Cámara de Diputados, 2010; INAI, s. f.).

**Accesibilidad e inclusión.** No fueron objetivo explícito del producto inicial; se adoptaron prácticas mínimas como contraste razonable, manejo del foco y mensajes textuales. Una auditoría siguiendo las pautas WCAG 2.2 (W3C, 2023) queda como línea futura alineada con la mejora de la usabilidad y los principios de diseño centrado en el usuario (Norman, 2013; Nielsen, 1994).

*[Figura 5. Arquitectura general por capas del sistema Escuela Pass: cliente web, servicio backend con NestJS, persistencia en PostgreSQL e integraciones externas opcionales (FCM, Mapbox, SMTP). Recomendado: Lucidchart con asistencia de Lucid AI; el prompt exacto se encuentra en `docs/tdg/prompts-imagenes-ia.md`.]*

*[Figura 6. Modelo entidad–relación resumido por dominios funcionales (núcleo institucional, académico, seguridad física, finanzas, comunicación y agenda). Recomendado: Lucidchart con Lucid AI; el detalle exhaustivo de las cuarenta y nueve entidades se entrega en el anexo correspondiente.]*

### 6.2. Marco legal (México)

El ordenamiento mexicano en materia de protección de datos personales en posesión de particulares se centra en la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares** (LFPDPPP, 2010) y en la normativa y lineamientos complementarios emitidos por el **Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales** (INAI). Las instituciones educativas privadas deben definir al responsable del tratamiento, las finalidades del mismo, los medios de ejercicio de los derechos de acceso, rectificación, cancelación y oposición, y los encargados o prestadores cuando aplique.

El software implementa apoyos técnicos de gobernanza —aceptación de políticas, registros de auditoría con marca temporal—. Los avisos de privacidad y los instrumentos de consentimiento o autorización legalmente válidos para menores son responsabilidad institucional y jurídica. El tratamiento de datos sensibles exige mayor cuidado; el sistema debe operarse con minimización y control de acceso acorde a políticas internas validadas por la institución.

### 6.3. Antecedentes

En los últimos cinco años la literatura y la industria han propuesto plataformas de gestión escolar, soluciones de control de acceso desacopladas del frente académico y herramientas de mensajería informal entre escuela y familia. Trabajos académicos sectoriales en México y otros países latinoamericanos (Martínez et al., 2025; UNESCO, 2024) documentan brechas digitales y el avance de la transformación educativa post‑pandemia, con énfasis en condiciones para aplicaciones responsables. Documentación técnica vigente sobre las pilas tecnológicas empleadas (NestJS Team, s. f.; PostgreSQL Global Development Group, s. f.; React Team, s. f.) orienta decisiones de implementación. Por su parte, la documentación arquitectónica clásica sobre estilos de software basados en red (Fielding, 2000) y la lectura aplicada de sistemas de información organizacionales (Laudon & Laudon, 2018) sostienen el marco conceptual.

Lo que distingue a Escuela Pass de los antecedentes consultados es la **orquestación** dentro de un mismo producto de identidad, acceso físico, circuito familiar, operación académico‑administrativa, comunicación institucional y cartera con revisión humana, manteniendo trazabilidad documental y código abierto al jurado para auditoría académica.

### 6.4. Limitaciones de los antecedentes y de la literatura revisada

**Tabla 3.** Limitaciones identificadas en antecedentes seleccionados.

| Enfoque o familia de solución | Limitación práctica para el proyecto |
| --- | --- |
| Plataformas comerciales cerradas de gestión escolar | Auditoría académica limitada por opacidad del código y los contratos. |
| Trabajos académicos sectoriales centrados en un único flujo | Replicabilidad parcial de la integración cruzada que aquí se busca. |
| Mensajería genérica fuera de política institucional | No sustituye el control de acceso ni provee gobernanza de datos. |
| Documentación técnica oficial de pilas tecnológicas | Cambia con frecuencia y exige citas con fecha de recuperación. |

---

### 6.5. Alcance

#### 6.5.1. Inclusiones

**Tabla 4.** Inclusiones principales del alcance.

| Ámbito | Inclusión |
| --- | --- |
| Identidad y seguridad | Autenticación con tokens portadores y roles; acceso físico mediante QR y NFC con eventos persistidos; limitación global de tasa de peticiones. |
| Circuito familiar | Flujo iniciado por padre o tutor con apoyo de mapa y tiempo estimado; transiciones institucionales explícitas y consentimientos donde aplica. |
| Gestión escolar y académica | Nómina escolar, grupos, asistencia, actividades y calificaciones, periodos académicos con cierre, boletines y calendario institucional. |
| Finanzas | Cartera, registro de comprobantes y verificación humana de pagos (sin pasarela bancaria automática). |
| Comunicación y tableros | Avisos, notificaciones, paneles y exportaciones; servicios externos opcionales con degradación elegante. |
| Operación multiinstitución | Soporte para múltiples escuelas en una misma instancia, conforme al diseño multi‑institucional. |
| Privacidad y auditoría | Políticas versionadas, registros de aceptación y trazas de auditoría según dominios implementados. |

#### 6.5.2. Exclusiones y supuestos

**Tabla 5.** Exclusiones explícitas del alcance.

| Exclusión | Comentario |
| --- | --- |
| Pasarela bancaria automática | El cobro se cierra con revisión humana de comprobantes; no se integra débito automatizado. |
| Biometría de alta seguridad | No se incluye reconocimiento biométrico ni hardware especializado de control. |
| Certificación formal del centro de datos | Fuera del alcance académico; se entrega trazabilidad mínima de salud del servicio. |
| Interpretación jurídica sustitutiva | El texto legal definitivo es responsabilidad del responsable del tratamiento y su asesoría. |
| Cobertura plena del catálogo HTTP en pruebas extremo a extremo | Se declara honestamente con un subconjunto representativo automatizado. |

**Supuestos.** La institución define políticas internas de salida, autorizaciones y reglas financieras; las familias disponen de dispositivos modernos compatibles con cámara y permisos de geolocalización donde el flujo lo requiere; el equipo institucional asignará al representante legal de la empresa para las firmas finales del paquete documental.

---

## 7. DESARROLLO DEL TRABAJO DE GRADO

Este capítulo desarrolla, en orden ascendente por objetivo específico, la narrativa ejecutiva del producto **Escuela Pass**. El nivel de granularidad mantiene el equilibrio entre profundidad académica y respeto por el formato editorial: las afirmaciones que requieren inventario exhaustivo —operaciones HTTP, columnas de base de datos, flujos por pantalla— se entregan en los anexos del trabajo.

### 7.1. Análisis de requerimientos (objetivo específico 1)

Las conversaciones con la contraparte empresarial consensuaron cinco grandes familias usuarias: el **administrador de plataforma**, con alcance multi‑institución; el **personal administrativo** de cada escuela, con responsabilidades sobre nómina, finanzas, calendario y reportes; el **docente**, vinculado a asignatura, grupo y al apoyo del circuito; el **padre o tutor**, responsable de iniciar el circuito de salida y de consultar la información académica y financiera de sus hijos; y el **alumno**, con consultas limitadas autorizadas (horario, calificaciones, credencial cuando aplica).

**Tabla 6.** Actores y responsabilidades macroscópicas.

| Actor | Responsabilidades macroscópicas |
| --- | --- |
| Administrador de plataforma | Operación multi‑institución, alta de escuelas y administradores, contexto transversal del producto. |
| Personal administrativo | Nómina, finanzas, calendario, reportes, visitas externas, agenda institucional y operación del circuito. |
| Docente | Asistencia, actividades, calificaciones, anotaciones, escaneo de credencial y apoyo al circuito. |
| Padre o tutor | Inicio del circuito de salida, consulta académica de hijos, gestión financiera y comunicación institucional. |
| Alumno | Consultas autorizadas sobre horario, calificaciones, boletines y credencial personal de acceso. |

Las reglas transversales relevantes —ventana antiduplicación de escaneos en un mismo día, una sola solicitud de circuito por estudiante por día, padre o tutor como conductor del circuito y verificación humana del comprobante— quedaron explícitas y se documentaron a nivel del servicio.

*[Figura 7. Diagrama de casos de uso del sistema Escuela Pass agrupado por los cinco actores institucionales, conforme a la notación UML 2.5.1 (OMG, 2017). Recomendado: Lucidchart con asistencia de Lucid AI; el detalle por actor se extiende en el anexo de UML.]*

### 7.2. Diseño del sistema, datos e interfaz (objetivo específico 2)

La arquitectura lógica separa el servicio web autenticado por tokens portadores con vencimiento configurable, del cliente de página única que consume sus contratos por HTTPS y JSON. La autenticación adopta el formato JWT especificado en el RFC 7519 (IETF, 2015). El modelo relacional cubre cuarenta y nueve entidades coherentes con el diccionario de datos del proyecto (Codd, 1970; Elmasri & Navathe, 2016), e incluye dominios académicos, de seguridad, de circuito, de finanzas, de comunicación y de operación multi‑institución.

La interfaz prioriza ergonomía diferenciada por familia usuaria, en línea con las heurísticas clásicas de usabilidad (Nielsen, 1994; Norman, 2013): el docente trabaja sobre paneles densos con tablas extensas de calificaciones; el padre o tutor opera flujos móviles con pocos toques para iniciar el circuito o consultar deudas. La estrategia responsiva permite operación desde escritorio y dispositivos móviles sin pérdida de funcionalidad esencial.

Las decisiones residuales de diseño —almacenamiento de credenciales en el cliente, exposición controlada de la documentación interactiva en producción y endurecimiento adicional sugerido como trabajo futuro— se discuten textualmente en el anexo de arquitectura como tabla de desviaciones frente al texto inicial de la propuesta.

### 7.3. Implementación del backend (objetivo específico 3)

El servicio web se construyó con NestJS, un marco modular para aplicaciones Node.js que ofrece organización por dominios, inyección de dependencias y validación declarativa de entradas (NestJS Team, s. f.; OpenJS Foundation, s. f.). Sobre esa base se implementaron los dominios de autenticación, control de accesos, circuito, gestión escolar, agenda, finanzas, comunicación, calendario, archivos y privacidad. La capa de persistencia se apoya en un ORM (Object-Relational Mapper) con consultas parametrizadas (TypeORM, s. f.), lo que reduce la superficie de inyección SQL accidental conforme a las recomendaciones del OWASP Top 10 (OWASP Foundation, 2021).

Los contratos HTTP del servicio suman doscientas cuarenta y una operaciones inferidas a partir de los decoradores de método de los controladores del proyecto, verificadas mediante un script reproducible incluido en el repositorio. La especificación viva en formato OpenAPI 3.1.0 (OpenAPI Initiative, 2021) se expone bajo demanda en entornos no productivos, y el catálogo completo se entrega en el anexo dedicado a la documentación de la API.

Como mitigaciones de abuso del servicio se aplicaron limitación global de tasa de peticiones, bloqueo por intentos en autenticación sensible, validación estricta de tipos y tamaños en cargas de archivos, y separación entre archivos públicos —como logos institucionales— y archivos privados servidos siempre por rutas autenticadas. La integración con servicios externos —notificaciones a navegadores mediante Firebase Cloud Messaging (Firebase, s. f.), mapas con Mapbox (Mapbox, s. f.) y correo con SMTP— se diseñó con *fallback* explícito cuando faltan credenciales, lo que permite demostrar el producto en entornos académicos sin comprometer su operación.

*[Figura 8. Diagrama UML de secuencia del circuito de recogida familiar, desde la solicitud del padre o tutor hasta la confirmación de entrega por el personal institucional (OMG, 2017). Recomendado: Lucidchart con asistencia de Lucid AI; secuencias adicionales por dominio se documentan en el anexo de UML.]*

*[Figura 9. Diagrama UML de secuencia del escaneo de credencial QR/NFC, incluyendo la regla antiduplicación dentro de la ventana breve y el marcado automático de asistencia diaria. Recomendado: Lucidchart con asistencia de Lucid AI.]*

### 7.4. Desarrollo del frontend (objetivo específico 4)

El cliente web se construyó con React (React Team, s. f.), un sistema de empaquetado moderno como Vite (Vite Team, s. f.) y utilidades de estilo responsivo. Las vistas se componen por familia usuaria; la navegación se filtra por rol y configuración institucional. Los flujos integran el uso de la cámara para escaneo de credenciales y la geolocalización opcional para el circuito cuando la institución la habilita. La autorización efectiva permanece siempre en servidor; el cliente sólo oculta y compone, sin atribuirse el control real de acceso.

Las extensiones de producto efectivamente ejecutadas —operación multi‑institución, dominios de visitas, reuniones, anotaciones, privacidad y auditoría— se documentan honestamente como evoluciones que extienden el alcance ejecutado sin modificar los objetivos específicos aprobados, siguiendo la misma tríada motivo–problema–beneficio recomendada por el asesor y consolidada en el anexo de arquitectura.

### 7.5. Validación y cierre técnico (objetivo específico 5)

Se ejecutaron baterías de pruebas extremo a extremo del servicio contra una base de datos PostgreSQL real, automatizadas en integración continua sobre la infraestructura del repositorio. Las pruebas de humo combinadas verifican el arranque del servicio y los flujos críticos de autenticación, control de accesos, circuito, asistencia, calificaciones y finanzas. La cobertura está honestamente sesgada hacia las pruebas extremo a extremo, y el plan de pruebas reconoce que las pruebas unitarias específicas de dominios sensibles son una línea de mejora explícita.

La medición fina de tiempos de respuesta y la evaluación de usabilidad con usuarios piloto quedan **planificadas** en el anexo de pruebas como **plan de medición** —no como medición ejecutada— para evitar afirmar evidencia que el horizonte académico no permitió capturar de modo estadísticamente significativo. Esta honestidad metodológica se sostiene a lo largo del documento.

---

## 8. RESULTADOS Y DISCUSIÓN

### 8.1. Síntesis cualitativa frente a la pregunta de investigación

La pregunta de investigación aprobada se centra en cómo una aplicación web basada en arquitecturas escalables con **NestJS**, **PostgreSQL** y tecnologías de identificación **QR/NFC** puede optimizar la seguridad física, la protección de datos sensibles y la administración escolar en instituciones educativas privadas de México, en armonía con los estándares normativos de protección de datos personales. Los hallazgos del trabajo demuestran que es factible construir una aplicación que integre estos frentes en un mismo producto manteniendo trazabilidad documental y separando responsabilidades entre lo que el software puede automatizar y lo que permanece como decisión institucional. La discusión no afirma cumplimiento normativo automático: el software alinea operación con principios de información, minimización y registro, pero el cumplimiento efectivo depende del responsable del tratamiento y de la asesoría jurídica institucional.

### 8.2. Cumplimiento por objetivo específico

**Análisis de requerimientos.** Las sesiones con la contraparte permitieron documentar especificaciones funcionales y no funcionales con reglas de negocio explícitas y matriz de trazabilidad cruzada con la implementación.

**Diseño del sistema, datos e interfaz.** Se entregaron vistas arquitectónicas de alto nivel, modelo de datos con cuarenta y nueve entidades, diagramas de comportamiento e interfaces responsivas con prototipos navegables, suficientes para guiar la implementación.

**Implementación del backend.** El servicio web modular sobre NestJS y PostgreSQL expone doscientas cuarenta y una operaciones HTTP, con validación de entrada, mapeador objeto‑relacional parametrizado, limitación global de tasa y separación clara por dominios funcionales.

**Desarrollo del frontend.** Se construyó un cliente con React y Vite responsivo por dispositivo, con integración con la cámara y geolocalización opcional, y con flujos diferenciados por rol que respetan la autorización efectiva del servicio.

**Validación.** Existe evidencia de pruebas extremo a extremo automatizadas contra una base de datos real, con integración continua reproducible en la plataforma del repositorio. Las mediciones de desempeño y usabilidad con muestras institucionales reales quedaron formalmente planificadas como plan de medición, conforme la honestidad metodológica del trabajo.

### 8.3. Reconocimiento honesto de los límites de medición

El **desempeño** del servicio bajo cargas reales —exportaciones masivas, generación de boletines, estimaciones de tiempo durante el circuito— se documenta con un método de medición y umbrales esperables, pero no se ejecutó como estudio en una institución con miles de usuarios concurrentes en el horizonte temporal del proyecto. La **usabilidad** se planificó como evaluación con usuarios piloto siguiendo instrumentos estandarizados, sin completar el estudio estadístico dentro del trabajo de grado. Estas dos áreas se proyectan como mediciones a ejecutar en una institución piloto real con posterioridad al cierre académico.

### 8.4. Papel de las decisiones técnicas evolutivas en el resultado

Las decisiones de despliegue sobre plataforma como servicio, la elección del proveedor de mapas con fallback de cálculo, la concreción de bibliotecas para identificación QR y la confirmación operativa del padre o tutor como conductor del circuito mejoraron la probabilidad de demostrar el producto en condiciones realistas, sin alterar el núcleo de la pregunta de investigación. El beneficio académico es directo: el jurado y la institución pueden seguir el rastro de cada decisión en el anexo de arquitectura, donde la tabla de desviaciones explicita el motivo, el problema resuelto y el beneficio observado, en línea con la orientación metodológica del asesor.

---

## 9. CONCLUSIONES

**Sobre el primer objetivo específico (análisis de requerimientos).** El trabajo establece una cadena verificable entre la propuesta aprobada, las actas con la contraparte empresarial y la matriz de trazabilidad consolidada en los anexos: los requerimientos funcionales y no funcionales quedaron especificados con criterios de aceptación medibles y reglas de negocio explícitas.

**Sobre el segundo objetivo específico (diseño).** El paquete de diseño entregado cubre arquitectura modular, modelo relacional de cuarenta y nueve entidades, diagramas de comportamiento y prototipos de interfaz responsiva alineados a los cinco roles. El costo del cambio de esquema queda acotado por migraciones documentadas y por la disciplina de versionado de la base de datos.

**Sobre el tercer objetivo específico (implementación del backend).** El servicio web sobre NestJS y PostgreSQL implementa doscientas cuarenta y una operaciones HTTP que cubren los dominios de autenticación, control de accesos QR y NFC, circuito familiar con apoyo de geolocalización, gestión escolar, finanzas con verificación humana de comprobantes, comunicación institucional y auditoría.

**Sobre el cuarto objetivo específico (desarrollo del frontend).** El cliente React con Vite materializa flujos diferenciados por rol con integración correcta con el servicio, soporte responsivo en escritorio y dispositivos móviles, y aprovechamiento de cámara y geolocalización donde la institución lo habilita.

**Sobre el quinto objetivo específico (validación).** La evidencia se concreta en pruebas extremo a extremo automatizadas con base de datos real, en pruebas de humo combinadas y en integración continua reproducible. Las mediciones de desempeño y usabilidad quedan honestamente planificadas como plan de medición a ejecutar con una institución piloto, en lugar de afirmarse como evidencia ya capturada.

**Conclusión integradora frente a la pregunta de investigación.** **Escuela Pass** demuestra como trabajo de ingeniería que es viable combinar arquitectura web escalable, identificación física mediante códigos QR y comunicación de campo cercano, circuito familiar con apoyo de geolocalización y operación académico‑administrativa en un mismo producto auditable, ofreciendo a las instituciones educativas privadas de México una herramienta técnica que apoya buenas prácticas de seguridad física, protección de datos personales y administración escolar. El cumplimiento normativo efectivo depende, en todo caso, del responsable del tratamiento y de la asesoría jurídica institucional; el software es complemento técnico, no sustituto de esas responsabilidades.

---

## 10. RECOMENDACIONES Y TRABAJOS FUTUROS

Se recomienda ejecutar un piloto en una institución real de tamaño medio para registrar mediciones explícitas de desempeño y completar la evaluación de usabilidad con muestras representativas, consolidando los planes ya entregados en el anexo de pruebas. Se recomienda incorporar al flujo de integración continua la compilación y verificación estática del cliente para reducir regresiones de empaquetado entre versiones. Se sugiere incrementar las pruebas unitarias en dominios críticos —cartera, circuito y autenticación— como complemento sano de la cobertura extremo a extremo. Conviene evaluar el endurecimiento de la sesión con cookies de solo servidor, mediante una capa intermedia que actúe como frontend del backend, en línea con buenas prácticas de seguridad de aplicaciones. Por último, se recomienda mantener la disciplina entre migraciones de base de datos, modelo entidad‑relación y especificación viva del contrato HTTP ante cambios persistentes, y archivar versiones congeladas de la especificación por entrega.

---

## 11. LICENCIA DEL PROYECTO ESCUELA PASS

*[Figura 10. Licencia del proyecto Escuela Pass — Imagen pendiente de aporte por el autor tras homologación con AlfaNetworks.]*

---

## 12. REFERENCIAS

*Formato APA séptima edición con sangría colgante de 0.5 pulgadas. Las fechas de recuperación de fuentes electrónicas se verifican al cierre editorial del documento.*

Booch, G., Rumbaugh, J., & Jacobson, I. (2007). *El lenguaje unificado de modelado: guía del usuario* (2.ª ed.). Addison‑Wesley.

Brooke, J. (1996). SUS: A quick and dirty usability scale. En P. W. Jordan, B. Thomas, B. A. Weerdmeester & I. L. McClelland (Eds.), *Usability evaluation in industry* (pp. 189–194). Taylor & Francis.

Cámara de Diputados del H. Congreso de la Unión. (2010, 5 de julio). *Ley Federal de Protección de Datos Personales en Posesión de los Particulares*. Diario Oficial de la Federación. https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf

Codd, E. F. (1970). A relational model of data for large shared data banks. *Communications of the ACM*, *13*(6), 377–387. https://doi.org/10.1145/362384.362685

Consejo Nacional de Evaluación de la Política de Desarrollo Social. (2024). *Estudio diagnóstico del derecho a la educación 2024*. CONEVAL. https://www.coneval.org.mx

Drumond, C. (2026). *Scrum: ¿qué es Scrum?*. Atlassian. https://www.atlassian.com/es/agile/scrum

Elmasri, R., & Navathe, S. B. (2016). *Fundamentals of database systems* (7.ª ed.). Pearson.

Fielding, R. T. (2000). *Architectural styles and the design of network‑based software architectures* [Tesis doctoral, University of California, Irvine]. https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm

Firebase. (s. f.). *Firebase Cloud Messaging — Admin SDK documentation*. Google. Consultado el 14 de mayo de 2026, en https://firebase.google.com/docs/cloud-messaging

GitHub. (s. f.). *GitHub Actions documentation*. Consultado el 14 de mayo de 2026, en https://docs.github.com/actions

Institute of Electrical and Electronics Engineers. (1998). *IEEE Std 830‑1998: Recommended practice for software requirements specifications*. IEEE.

Institute of Electrical and Electronics Engineers. (2008). *IEEE Std 829‑2008: Standard for software and system test documentation*. IEEE.

Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales. (s. f.). *Normativa y guías en materia de protección de datos personales*. Gobierno de México. Consultado el 14 de mayo de 2026, en https://home.inai.org.mx

International Organization for Standardization. (2011). *ISO/IEC 25010:2011 — Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*. ISO. https://www.iso.org/standard/35733.html

Internet Engineering Task Force. (2015). *RFC 7519: JSON Web Token (JWT)* (M. Jones, J. Bradley, & N. Sakimura, Autores). IETF. https://datatracker.ietf.org/doc/html/rfc7519

Krug, S. (2014). *Don't make me think, revisited: A common sense approach to web usability* (3.ª ed.). New Riders.

Laudon, K. C., & Laudon, J. P. (2018). *Sistemas de información gerencial* (15.ª ed.). Pearson Educación.

Lewis, J. R., & Sauro, J. (2018). Item benchmarks for the System Usability Scale. *Journal of Usability Studies*, *13*(3), 158–167.

Mapbox. (s. f.). *Mapbox GL JS documentation*. Consultado el 14 de mayo de 2026, en https://docs.mapbox.com/mapbox-gl-js

Martínez Reyes, Á., Rivera López, M., González Pineda, S., & Torres Ramírez, L. E. (2025). Competencias digitales docentes en escuelas privadas mexicanas en el contexto post pandémico. *Revista de Innovación Educativa*, *22*(42), 1–24.

MetaRed. (2024). *Madurez digital de las instituciones de educación superior en Iberoamérica*. Universia. https://www.metared.org

Ministerio de Educación Nacional de Colombia. (2024). *Informe de gestión 2024*. MEN. https://www.mineducacion.gov.co

NestJS Team. (s. f.). *NestJS documentation*. Consultado el 14 de mayo de 2026, en https://docs.nestjs.com

Nielsen, J. (1994). *Usability engineering*. Academic Press.

Norman, D. A. (2013). *The design of everyday things* (Edición revisada y ampliada). Basic Books.

Object Management Group. (2017). *OMG Unified Modeling Language (UML) — Version 2.5.1*. OMG. https://www.omg.org/spec/UML/2.5.1

OnTrack School. (2024). *Informe sobre rutas escolares en Bogotá*. https://www.ontrackschool.com

OpenAPI Initiative. (2021). *OpenAPI Specification version 3.1.0*. Linux Foundation. https://spec.openapis.org/oas/v3.1.0

OpenJS Foundation. (s. f.). *Node.js documentation*. Consultado el 14 de mayo de 2026, en https://nodejs.org/en/docs

Organización de las Naciones Unidas para la Educación, la Ciencia y la Cultura. (2024). *Transformación digital de la educación: guías y perspectivas*. UNESCO. https://unesdoc.unesco.org

OWASP Foundation. (2021). *OWASP Top 10: 2021 — Web application security risks*. https://owasp.org/Top10

OWASP Foundation. (2023). *OWASP API Security Top 10*. https://owasp.org/API-Security

PostgreSQL Global Development Group. (s. f.). *PostgreSQL documentation*. Consultado el 14 de mayo de 2026, en https://www.postgresql.org/docs

Pressman, R. S., & Maxim, B. R. (2020). *Ingeniería del software: un enfoque práctico* (9.ª ed.). McGraw‑Hill.

React Team. (s. f.). *React documentation*. Meta Open Source. Consultado el 14 de mayo de 2026, en https://react.dev

Santhosh, K. (2025). *Best school management software in 2025*. Cloudi5 Technologies. https://www.cloudi5.com

Schwaber, K., & Sutherland, J. (2020). *The Scrum Guide* (Versión noviembre 2020). https://scrumguides.org/scrum-guide.html

Skolable. (2026). *Plataforma integral para gestión escolar*. https://www.skolable.com

TypeORM. (s. f.). *TypeORM documentation*. Consultado el 14 de mayo de 2026, en https://typeorm.io

Vite Team. (s. f.). *Vite documentation*. Consultado el 14 de mayo de 2026, en https://vitejs.dev

World Wide Web Consortium. (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. W3C. https://www.w3.org/TR/WCAG22

---

## 13. LISTA DE FIGURAS Y TABLAS

| Id | Descripción |
| --- | --- |
| Figura 1 | Portada institucional según el instructivo del Área APIT. |
| Figura 2 | Contraportada institucional según el instructivo del Área APIT. |
| Figura 3 | Diagrama orientativo del orden del documento y sus anexos (sección 5.6). |
| Figura 4 | Cronograma Gantt del proyecto (24/02/2026 – 21/06/2026) (sección 5.7). |
| Figura 5 | Arquitectura general por capas del sistema Escuela Pass (sección 6.1). |
| Figura 6 | Modelo entidad–relación resumido por dominios funcionales (sección 6.1). |
| Figura 7 | Diagrama UML de casos de uso por actor institucional (sección 7.1). |
| Figura 8 | Diagrama UML de secuencia del circuito de recogida familiar (sección 7.3). |
| Figura 9 | Diagrama UML de secuencia del escaneo de credencial QR/NFC (sección 7.3). |
| Figura 10 | Licencia del proyecto (imagen pendiente de aporte por el autor) (sección 11). |

| Tabla | Contenido |
| --- | --- |
| Tabla 1 | Problemática: causas y consecuencias (capítulo 1) |
| Tabla 2 | Fases metodológicas y resultados esperados (capítulo 2) |
| Tabla 3 | Limitaciones de antecedentes (capítulo 3) |
| Tabla 4 | Inclusiones del alcance (capítulo 3) |
| Tabla 5 | Exclusiones del alcance (capítulo 3) |
| Tabla 6 | Actores y responsabilidades macroscópicas (capítulo 4) |

---

## 14. GLOSARIO DE ACRÓNIMOS

*Las siglas se introducen en el documento mediante la convención **expansión (sigla)** la primera vez que aparecen en cada capítulo o anexo. El glosario consolidado se ofrece a continuación para consulta rápida.*

| Sigla | Expansión |
| --- | --- |
| API | Application Programming Interface (interfaz de programación de aplicaciones). |
| APA 7 | American Psychological Association, séptima edición del manual de estilo. |
| APIT | Programas Informáticos y Telecomunicaciones (área curricular del programa de Ingeniería Informática). |
| BFF | Backend for Frontend (capa intermedia entre el cliente y el servicio). |
| CDN | Content Delivery Network (red de distribución de contenidos). |
| CI | Continuous Integration (integración continua). |
| CSP | Content Security Policy (política de seguridad de contenidos). |
| DDL | Data Definition Language (lenguaje de definición de datos). |
| DOF | Diario Oficial de la Federación (México). |
| ER | Entity-Relationship (modelo entidad-relación). |
| FCM | Firebase Cloud Messaging (mensajería en la nube de Firebase). |
| FTG | Ficha de Trabajo de Grado. |
| GPS | Global Positioning System (sistema de posicionamiento global). |
| HTTP / HTTPS | Hypertext Transfer Protocol / Secure (protocolo de transferencia de hipertexto, seguro). |
| INAI | Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales. |
| ISO/IEC | International Organization for Standardization / International Electrotechnical Commission. |
| IEEE | Institute of Electrical and Electronics Engineers. |
| JWT | JSON Web Token (norma RFC 7519). |
| LFPDPPP | Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México, 2010). |
| MVP | Minimum Viable Product (producto mínimo viable). |
| NFC | Near Field Communication (comunicación de campo cercano). |
| ORM | Object-Relational Mapper (mapeador objeto-relacional). |
| OWASP | Open Worldwide Application Security Project. |
| PaaS | Platform as a Service (plataforma como servicio). |
| QR | Quick Response (código de respuesta rápida). |
| REST | Representational State Transfer (transferencia de estado representacional). |
| RFC | Request for Comments (estándares publicados por la IETF). |
| SLA | Service Level Agreement (acuerdo de nivel de servicio). |
| SPA | Single-Page Application (aplicación de página única). |
| SQL | Structured Query Language (lenguaje estructurado de consultas). |
| STRIDE | Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege (modelo de amenazas). |
| SUS | System Usability Scale (escala de usabilidad de sistemas, Brooke 1996). |
| TDG | Trabajo de Grado. |
| UI / UX | User Interface / User Experience (interfaz y experiencia de usuario). |
| UML | Unified Modeling Language (lenguaje unificado de modelado). |
| WCAG | Web Content Accessibility Guidelines (pautas de accesibilidad para el contenido web). |

---

## 15. ÍNDICE DE ANEXOS

| Anexo | Título |
| --- | --- |
| 00 | Matriz de trazabilidad |
| 01 | Documento de requerimientos |
| 02 | Acta consolidada de reuniones |
| 03 | Documento de arquitectura |
| 04 | Modelo entidad–relación |
| 05 | Diagramas UML |
| 06 | Prototipos UI/UX |
| 07 | Manual técnico |
| 08 | Documentación de la API |
| 09 | Manual de usuario |
| 10 | Informe de pruebas y métricas |

---

*Fin del texto principal — TDG Escuela Pass 2026.* La extensión final en Word con Times New Roman 12 pt, márgenes 2.54 cm e interlineado sencillo debe situar el documento en el rango orientado de 48 a 50 páginas; si el material supera el tope, conviene trasladar detalle técnico adicional a los anexos numerados.
