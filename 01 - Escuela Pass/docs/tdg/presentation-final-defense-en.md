# Escuela Pass — Guion oral de defensa (22 diapositivas)

| Campo | Valor |
| --- | --- |
| **Uso** | Texto a decir en voz alta durante la sustentación |
| **Idioma del guion** | Español (láminas en inglés; exponer en español) |
| **Duración estimada** | ≤12 minutos + preguntas |
| **Diapositivas** | 22 |
| **Presentación** | `EscuelaPass-Defensa.pdf` |
| **Fuentes** | TDG-2 maestro v2 (cuerpo principal) · Q&A: `defensa-preguntas-y-conceptos.md` |

*Consejo:* habla en primera persona, conecta cada bloque con la idea anterior y no leas las viñetas en inglés. En diapositivas solo con figura, señala la imagen y sigue el hilo del discurso.

---

## Diapositiva #1 — Portada (~35 s)

Buenos días, miembros del jurado, docente asesor y audiencia.

Mi nombre es **Jhon Kevin Murillo Martínez**, y hoy presento mi trabajo de grado **Escuela Pass: aplicación web para la administración escolar y la seguridad del plantel**, que desarrollé con **NestJS**, **PostgreSQL** y tecnologías **QR** (código bidimensional) y **NFC** (comunicación por proximidad).

Sustento este grado en el **Politécnico Colombiano Jaime Isaza Cadavid**, bajo la orientación del asesor **Alirio Antonio Gutiérrez Quintero**, en el marco del caso de estudio **AlfaNetworks** y con referencia operativa en escuelas privadas de **México**, en **mayo de 2026**.

En los próximos **doce minutos** les mostraré el problema que abordé, la solución que construí, cómo la validé y las conclusiones que defiendo al cierre de este grado.

---

## Diapositiva #2 — Agenda (~10 s)

*[Opcional: omitir esta diapositiva y decir en voz al pasar.]*

Organizo la exposición en cuatro bloques: **contexto y problema**, **marco de investigación**, **solución Escuela Pass** y **validación con cierre**.

---

## Diapositiva #3 — Divisor: Capítulo 01 — Contexto y problema (~8 s)

Para situar el trabajo, empiezo por el **contexto y el planteamiento del problema** en escuelas privadas mexicanas.

---

## Diapositiva #4 — Contexto: tres presiones (~40 s)

En mi revisión del sector, las escuelas privadas en **México** enfrentan a la vez **seguridad física** en el plantel, **coordinación con las familias** en ingreso y recogida, y **tratamiento responsable de datos personales**.

Eso se nota sobre todo en horarios críticos, cuando el personal de portería debe decidir con rapidez **sin perder trazabilidad**, mientras muchas instituciones aún mezclan **hojas de cálculo**, **mensajería informal** y sistemas que no se integran entre sí.

Como la población incluye **menores**, la gobernanza de datos dejó de ser un detalle técnico: debe alinearse con la **LFPDPPP** (Ley Federal de Protección de Datos Personales en Posesión de los Particulares) y con los lineamientos del **INAI** (Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales).

Por eso orienté el proyecto hacia un **canal digital único y trazable**, y no hacia más herramientas aisladas.

*No decir en voz:* fuentes del pie (CONEVAL, UNESCO, MetaRed).

---

## Diapositiva #5 — Problema: fragmentación operativa (~45 s)

A partir de ese contexto, identifiqué como **problema central** la **fragmentación operativa**: portería, recogida familiar, administración y comunicación viven en canales distintos.

Cuando los registros están dispersos, aparecen **errores, demoras y auditoría débil**; cuando el acceso físico no se correlaciona con identidad digital, crecen los **incidentes y las disputas con familias**; y cuando faltan flujos explícitos de consentimiento, aumenta el **riesgo normativo** y se pierde confianza.

La necesidad que planteé es un canal que concentre políticas, registros y trazabilidad. Diseñé el software para **instrumentar** protocolos institucionales, sabiendo que **no sustituye** el criterio pedagógico ni la asesoría jurídica.

Tomé como referencia de despliegue **México** bajo **LFPDPPP** e **INAI**, y documenté **Colombia** como horizonte de expansión, porque el núcleo de ingeniería —control de acceso por roles, privacidad versionada y auditoría— es portable a ambos marcos.

*No decir en voz:* leer la tabla causa–consecuencia fila por fila.

---

## Diapositiva #6 — Divisor: Capítulo 02 — Marco de investigación (~8 s)

Con el problema definido, paso al **marco de investigación**: la pregunta que me guió, los objetivos y la metodología que seguí.

---

## Diapositiva #7 — Pregunta de investigación y objetivos (~50 s)

Formulé la **pregunta de investigación** así, en lenguaje operativo:

*¿Cómo una aplicación web de AlfaNetworks con NestJS, PostgreSQL, QR y NFC puede optimizar seguridad física, protección de datos y administración escolar en escuelas privadas de México, alineada a la normativa de datos personales?*

Delimité el alcance excluyendo pasarelas de pago automáticas y biometría de alta seguridad en torniquetes, para concentrarme en una plataforma web integrada que la escuela pueda desplegar y auditar.

Mi **objetivo general** fue desarrollar esa aplicación para administración escolar y seguridad del plantel. Lo desagregué en **cinco objetivos específicos**: analizar requerimientos, diseñar arquitectura y datos, implementar el *backend*, construir el *frontend* por rol y **validar** el sistema con pruebas automatizadas y medición de rendimiento.

En el quinto objetivo cerré la **evidencia técnica** con pruebas **E2E** (extremo a extremo), **CI** (integración continua) y caracterización de carga; el plan de evaluación con usuarios en campo quedó trazado para la siguiente etapa del producto.

*No decir en voz:* el párrafo literal completo de la pregunta en inglés de la lámina.

---

## Diapositiva #8 — Metodología (~40 s)

Para ejecutar esos objetivos seguí **ingeniería de software iterativa e incremental**, guiada por **Scrum** (marco ágil de entregas semanales).

Organicé el trabajo en cinco fases —análisis, diseño, *backend*, *frontend* y validación— alineadas a los objetivos específicos. Las siete fases de la propuesta original las mapeé a esos cinco resultados: el **despliegue** quedó embebido en la implementación, y la **evaluación** en la fase de validación.

Para verificar cada incremento combiné revisión de código, **cuarenta y siete pruebas E2E** sobre **PostgreSQL** real, inspección del contrato **OpenAPI** (especificación de la API) y un pipeline de **CI** que compila el servicio y ejecuta E2E contra **PostgreSQL 16**.

Ese enfoque me permitió mantener **trazabilidad** de punta a punta: de requerimientos a diseño, de diseño a código y de código a evidencia automatizada.

---

## Diapositiva #9 — Figura 4: Cronograma Gantt (~18 s)

*Figura TDG:* **Figura 4** — Cronograma Gantt del proyecto (24 de febrero – 21 de junio de 2026).

En la **Figura 4** del trabajo de grado resumo ese calendario: cinco fases ligadas a cada objetivo, desde el análisis con AlfaNetworks hasta la validación con pruebas automatizadas.

*No decir en voz:* leer fechas del Gantt; la imagen habla.

---

## Diapositiva #10 — Divisor: Capítulo 03 — La solución (~8 s)

Con esa base metodológica, la respuesta concreta al problema es **Escuela Pass**: una plataforma web integrada bajo un solo *backend* transaccional.

---

## Diapositiva #11 — Solución: roles y capacidades (~35 s)

**Escuela Pass** es el producto que entregué: unifica portería, circuito familiar, académico, finanzas y comunicación en un solo sistema.

Implementé un *backend* que expone la API versionada `api/v1` y un cliente **sensible al rol** para cinco actores —administrador de plataforma, personal administrativo, docente, padre o tutor y alumno— repartidos en siete dominios funcionales.

No es un mock-up en diapositivas: es un entregable **demostrable** que pueden contrastar con mi trabajo de grado y con el repositorio.

La arquitectura por capas la verán en la **siguiente lámina**; aquí me concentro en qué hace el producto y para quién.

*No decir en voz:* bloque «Architecture at a Glance» si aún aparece en la lámina.

---

## Diapositiva #12 — Figura 5: Arquitectura por capas (~22 s)

*Figura TDG:* **Figura 5** — Arquitectura general por capas del sistema Escuela Pass.

La **Figura 5** resume cómo lo construí: **cliente React**, **API NestJS** con autenticación y guardias por rol, **PostgreSQL** con migraciones versionadas, e integraciones **FCM** (notificaciones *push*), **SMTP** (correo) y **Mapbox** (mapas) como **opcionales** —si faltan credenciales, el núcleo escolar sigue operando.

La regla que sostuve en todo el diseño es que la **autorización en el servidor es la fuente de verdad**; el navegador no la reemplaza.

---

## Diapositiva #13 — Métricas del repositorio (~35 s)

Para dimensionar lo que entregué, consolidé en el trabajo de grado un panel de hechos **verificables en el repositorio**.

En voz destaco dos cifras que anclan la defensa: **doscientas cuarenta y uno** operaciones **REST** (interfaz HTTP por recursos) bajo `api/v1`, y **cuarenta y siete** casos de prueba **E2E** sobre PostgreSQL real. Me interesan porque muestran profundidad del contrato y regresión reproducible —son hechos de ingeniería auditables, no afirmaciones de marketing.

El resto —treinta y siete módulos, treinta y dos controladores, cuarenta y nueve entidades, treinta y nueve migraciones, cinco roles y unas veintiséis vistas— está en la lámina para su consulta.

*No decir en voz:* enumerar los ocho KPI uno por uno.

---

## Diapositiva #14 — Actores y decisiones de diseño (~40 s)

En operación, diseñé permisos diferenciados por actor. El **administrador** gestiona multiinstitución; el **personal administrativo** atiende nómina, finanzas, portería y mesa del circuito; el **docente** maneja asistencias y calificaciones; el **padre o tutor** opera el circuito, vehículos y consentimientos; el **alumno** consulta horario, calificaciones y credencial.

Esa cobertura abarca identidad, circuito familiar, académico, finanzas, comunicación, privacidad y multiinstitución.

Una decisión que quise dejar clara es que el **padre o tutor inicia el circuito de recogida**, no un módulo interno de conductores, porque así reflejé la práctica real y simplifiqué reglas ejecutables en servidor, con distancia **Haversine** (cálculo geográfico en el *backend*).

*No decir en voz:* las cuatro cajas de «Key Design Decisions» palabra por palabra.

---

## Diapositiva #15 — Figura 7: Casos de uso (~18 s)

*Figura TDG:* **Figura 7** — Diagrama UML de casos de uso por actor institucional.

La **Figura 7** visualiza lo que acabo de describir: los **cinco actores** y sus casos de uso sobre los dominios del producto, según el capítulo de desarrollo del trabajo de grado.

---

## Diapositiva #16 — Flujos críticos: portería y circuito (~50 s)

Sobre esa estructura de actores, concentré la seguridad operativa en **dos flujos críticos**.

En **acceso físico**, el personal escanea **QR** o **NFC** desde el móvil; el cliente llama al endpoint de escaneo y yo validé en servidor toda la credencial. Apliqué una ventana de **unos diez segundos** para evitar eventos duplicados, y un ingreso válido de alumno puede marcar **asistencia diaria**, siempre con criterio humano en casos excepcionales.

En el **circuito familiar**, el padre crea la solicitud; las actualizaciones **GPS** (posición del dispositivo) se procesan en servidor con **Haversine**; el personal avanza estados hasta la **entrega confirmada**, con la regla de **una solicitud activa por estudiante por día**.

En ambos flujos la regla es la misma: las credenciales y las reglas de negocio **no se confían solo al dispositivo**.

*No decir en voz:* lista de librerías al pie.

---

## Diapositiva #17 — Figuras 9 y 8: Secuencias UML (~20 s)

*Figura TDG:* **Figura 9** — Secuencia del escaneo QR/NFC; **Figura 8** — Secuencia del circuito de recogida familiar.

Las **Figuras 9 y 8** formalizan esos dos flujos en el capítulo de desarrollo: portería con antiduplicación y asistencia, y circuito familiar desde el padre o tutor hasta el cierre por personal escolar.

*No decir en voz:* repetir los cinco pasos numerados de la lámina anterior.

---

## Diapositiva #18 — Stack tecnológico (~30 s)

Para sostener esos flujos elegí un stack **TypeScript** de extremo a extremo: **NestJS** y **PostgreSQL** en el servicio, **React** y **Vite** en el cliente, contrato **OpenAPI 3.1** y despliegue tipo **PaaS** (plataforma como servicio con proceso Node en vivo, no hospedaje PHP clásico).

También diseñé las integraciones externas para **degradar con elegancia** si faltan credenciales.

Hoy los tokens **JWT** (JSON Web Token, sesión firmada) viven en el almacenamiento del navegador; en trabajo futuro evaluaré **cookies httpOnly**, capa **BFF** (backend-for-frontend) y **CSP** (política de seguridad de contenidos) más estrictas.

*No decir en voz:* las veinte viñetas de BACKEND/FRONTEND/OPERATIONS.

---

## Diapositiva #19 — Divisor: Capítulo 04 — Validación y cierre (~8 s)

Con la solución construida, cierro mostrando **cómo la validé**, qué resultados obtuve y hacia dónde puede evolucionar el producto.

---

## Diapositiva #20 — Validación, Figura 11 y RNF4 (~55 s)

*Figura TDG:* **Figura 11** — Resumen de la prueba de carga simulada (indicio **RNF4** — requerimiento no funcional de tiempo de respuesta).

Validé el sistema con **cuarenta y siete E2E** en Jest sobre PostgreSQL real y con **CI** en **PostgreSQL 16**.

Además ejecuté una **prueba de carga simulada** sobre el catálogo de **doscientas cuarenta y una** operaciones: sondeé **doscientas veinticuatro** —omitiendo **diecisiete** DELETE para no alterar la semilla— y ejercité **setenta y dos** GET válidos con **diez clientes concurrentes durante treinta segundos**.

La **Figura 11** condensa el resultado: p95 de unos **treinta y siete milisegundos** en el sondeo, y bajo carga **seis mil trescientas setenta y seis** peticiones con p95 cercano a **ciento setenta y cinco milisegundos**, con **cien por ciento** bajo el umbral orientativo de **dos segundos**.

Lo presento como **indicio técnico** en laboratorio de integración que complementa E2E y CI, coherente con el alcance de este grado.

*No decir en voz:* leer las cuatro viñetas de LIMITATIONS una por una.

---

## Diapositiva #21 — Resultados y respuesta a la investigación (~45 s)

Con esa evidencia, sintetizo lo logrado en cinco ejes: **operación integrada** en un solo producto; **acceso seguro** con validación en servidor; **recogida coordinada** por la familia; **gobernanza de datos** con políticas versionadas y auditoría alineada a la **LFPDPPP**; y **validación reproducible** ligada al repositorio.

Frente a la pregunta de investigación, mi respuesta es **afirmativa con matices**: demostré un **camino técnico viable**, documentado y verificable hacia mejor seguridad en plantel, coordinación familiar y administración escolar con tratamiento responsable de datos.

El matiz es honesto y acotado: las **ganancias porcentuales a nivel institución** de la propuesta original —tiempo, papelería, retorno de inversión— requieren medición en campo con instituciones piloto; aquí cerré el núcleo de ingeniería que hace posible esa siguiente etapa.

*No decir en voz:* tabla OBJECTIVE COMPLIANCE fila por fila ni enumerar límites por objetivo.

---

## Diapositiva #22 — Conclusiones, trabajos futuros y cierre (~40 s)

Cierro afirmando que **Escuela Pass** es una respuesta **técnicamente demostrable y documentalmente trazable** a la fragmentación operativa en escuelas privadas mexicanas.

Mi aporte central es la **correspondencia texto–código**: entidades, rutas REST y casos E2E que ustedes pueden auditar frente al trabajo de grado y al repositorio.

Como líneas de evolución natural del producto —capítulo siete del TDG— priorizo **CI del *frontend***, endurecimiento de sesión, un **piloto institucional** con **SUS** (System Usability Scale, escala de usabilidad) y ampliación de pruebas unitarias en lógica crítica del circuito y la cartera.

Muchas gracias por su atención. Quedo atento a sus preguntas; para el Q&A preparé material complementario en `defensa-preguntas-y-conceptos.md`.

---

## Referencia rápida — tiempos

| Diap. | Tema | Tiempo |
| --- | --- | --- |
| 1 | Portada | ~35 s |
| 2 | Agenda | ~10 s |
| 3 | Divisor 01 | ~8 s |
| 4 | Contexto | ~40 s |
| 5 | Problema | ~45 s |
| 6 | Divisor 02 | ~8 s |
| 7 | Pregunta y objetivos | ~50 s |
| 8 | Metodología | ~40 s |
| 9 | Figura 4 — Gantt | ~18 s |
| 10 | Divisor 03 | ~8 s |
| 11 | Solución (roles) | ~35 s |
| 12 | Figura 5 — Arquitectura | ~22 s |
| 13 | Métricas | ~35 s |
| 14 | Actores | ~40 s |
| 15 | Figura 7 — Casos de uso | ~18 s |
| 16 | Flujos críticos | ~50 s |
| 17 | Figuras 9 y 8 | ~20 s |
| 18 | Stack | ~30 s |
| 19 | Divisor 04 | ~8 s |
| 20 | Validación + Figura 11 | ~55 s |
| 21 | Resultados | ~45 s |
| 22 | Cierre | ~40 s |
| **Total** | | **~11 min 50 s** |

---

## Guía de práctica

1. **Primera corrida:** lee el guion con `EscuelaPass-Defensa.pdf` en modo presentación y cronometra.
2. **Si superas 12 minutos:** omite la diapositiva 2 (agenda) y acorta divisores 3, 6, 10 y 19 a una frase de cinco segundos.
3. **Si quedas bajo 11 minutos:** amplía la diapositiva 16 (flujos) o la 21 (cinco ejes de resultados).
4. **Diapositivas solo figura (9, 12, 15, 17, 20):** señala la imagen; enlaza con «como ven en la figura…».
5. **Preguntas probables:** repasa respuestas cortas en `defensa-preguntas-y-conceptos.md`.
