# Escuela Pass — Preguntas, respuestas y conceptos para la defensa

| Campo | Valor |
| --- | --- |
| **Uso** | Preparación para preguntas del asesor y jurado (después de la exposición) |
| **Idioma** | Español (respuestas orales; láminas pueden estar en inglés) |
| **Fuente** | TDG-2 maestro v2 — cuerpo principal (caps. 1–7) |
| **Complemento** | Guion por lámina en `presentation-final-defense-en.md` |
| **Preguntas estimadas** | ~30 + 5 difíciles |

---

## Cómo usar este documento

1. **Primero** lee la **Parte A** (conceptos). Si dominas las definiciones y cómo se ven en el repo, las preguntas técnicas son más fáciles.
2. **Después** repasa la **Parte B** por bloques temáticos. Practica en voz alta solo la **respuesta corta** de cada pregunta.
3. Si el jurado profundiza, usa la **respuesta extendida** y el **dato concreto**.
4. Cierra con la **Parte C** (preguntas incómodas) y el **checklist** la noche anterior.

**Regla de oro en defensa:** responde con honestidad académica. Reconocer un límite (piloto pendiente, JWT en navegador) **no debilita** el trabajo si inmediatamente explicas qué sí quedó demostrado.

---

# Parte A — Conceptos clave

Cada concepto incluye definición breve, evidencia en Escuela Pass y una frase lista para decir en defensa.

---

### API REST / RESTful

**Qué es (breve):** REST (*Representational State Transfer*) es un estilo arquitectónico para sistemas distribuidos en web (Fielding, 2000). Se organiza alrededor de **recursos** identificables por URL, operados con **verbos HTTP** (`GET`, `POST`, `PATCH`, `DELETE`), intercambio típico en **JSON**, y comunicación **sin estado** entre peticiones (la sesión se maneja con tokens, no con estado de servidor en cada click).

**En Escuela Pass:** El servicio NestJS expone **241 operaciones REST** bajo el prefijo versionado `api/v1`. Hay **32 controladores** agrupados por dominio: autenticación (`auth`), eventos de acceso (`access-events`), circuito familiar (`circuit-requests`), pagos (`payments`), asistencias, periodos académicos, etc. La documentación del contrato se genera con **OpenAPI 3.1** (Swagger). El cliente React consume esos endpoints vía **HTTPS + JSON** con Axios.

**Evidencia concreta:**
- Un escaneo en portería: `POST /api/v1/access-events/scan`
- Crear circuito: `POST /api/v1/circuit-requests`
- Las **47 pruebas E2E** levantan el servidor real y validan respuestas HTTP contra PostgreSQL

**Si preguntan:** «Escuela Pass implementa una API REST versionada con 241 operaciones documentadas; el cliente y las pruebas E2E consumen el mismo contrato HTTP que describe el trabajo de grado.»

---

### NestJS y arquitectura modular

**Qué es (breve):** NestJS es un framework de Node.js para aplicaciones escalables, estructurado con **módulos**, **controladores** (capa HTTP), **servicios** (lógica de negocio) e **inyección de dependencias**. Facilita separar dominios y aplicar guardias, pipes y filtros de forma transversal.

**En Escuela Pass:** La raíz del servicio importa **37 módulos** NestJS. Cada dominio escolar (finanzas, circuito, asistencias, privacidad…) vive en módulos cohesionados. Los controladores reciben peticiones; los servicios ejecutan reglas; TypeORM persiste en PostgreSQL.

**Si preguntan:** «Elegimos NestJS porque el producto es transaccional y multi-dominio: la modularidad no es cosmética, es cómo aislamos portería, circuito y cartera sin un monolito indistinguible.»

---

### SPA (Single Page Application) — React + Vite

**Qué es (breve):** Una SPA carga una sola página HTML y navega entre vistas en el cliente sin recargar el documento completo. **React** gestiona la interfaz por componentes; **Vite** empaqueta y sirve el cliente en desarrollo y producción con tiempos de compilación rápidos.

**En Escuela Pass:** Cliente **React 18** con **Vite 6**, **Tailwind CSS** y **React Router v7**. Hay unas **26 vistas principales** filtradas por rol (`RoleGate`). Flujos críticos móviles: escáner de portería, circuito del padre/tutor, consultas académicas.

**Si preguntan:** «El frontend es una SPA por rol: la autorización real ocurre en el servidor; la UI solo presenta flujos y no sustituye los guardias del backend.»

---

### PostgreSQL + TypeORM + migraciones

**Qué es (breve):** PostgreSQL es un sistema gestor de bases de datos **relacional** con integridad referencial y transacciones ACID. **TypeORM** mapea tablas a clases (*entidades*) en TypeScript. Las **migraciones** versionan cambios de esquema de forma reproducible entre entornos.

**En Escuela Pass:** **49 entidades** TypeORM, **39 archivos de migración**, tabla de control `typeorm_migrations`. En producción **no** se usa `synchronize: true` (auto-sync desactivado): el esquema evoluciona solo por migraciones aplicadas.

**Si preguntan:** «La persistencia es relacional y versionada: 49 entidades y 39 migraciones contrastables con el modelo del capítulo 4 y el repositorio.»

---

### JWT y control de acceso por roles (RBAC)

**Qué es (breve):** **JWT** (*JSON Web Token*) es un token firmado que transporta claims (p. ej. usuario, rol) entre cliente y servidor. **RBAC** (*Role-Based Access Control*) autoriza operaciones según el rol institucional (`ADMIN`, `DOCENTE`, etc.).

**En Escuela Pass:** Cinco roles de aplicación. Tras login, el cliente envía el JWT en cabecera `Authorization`; los **guards** de NestJS validan token, estado del usuario y permisos antes de ejecutar la lógica. Hay JWT de acceso y *refresh* con rotación acorde al módulo de autenticación.

**Deuda reconocida:** tokens en **almacenamiento local del navegador** (no cookies `httpOnly`). Riesgo teórico frente a XSS; mitigación futura: BFF, cookies endurecidas, CSP (capítulo 7).

**Si preguntan:** «La autorización es en servidor con JWT y guards por rol; el almacenamiento en navegador es una decisión documentada con deuda de seguridad explícita hacia cookies httpOnly o BFF.»

---

### Pruebas E2E vs pruebas unitarias

**Qué es (breve):** Las pruebas **unitarias** validan una función o clase **aislada** (rápidas, muchas). Las pruebas **E2E** (*end-to-end*) recorren flujos completos —cliente HTTP, servidor, base de datos— simulando uso real (más lentas, más cercanas a regresión integral).

**En Escuela Pass:** **47 casos E2E** con Jest sobre **PostgreSQL real**, en tres especificaciones. Cubren flujos críticos: auth, acceso, circuito, cartera, etc. Las **unitarias** en lógica sensible (Haversine, deudas) quedan como **trabajo futuro** (capítulo 7): hoy la regresión pesada está en E2E.

**Si preguntan:** «Priorizamos E2E porque el riesgo del producto es integración entre dominios y contrato HTTP; las unitarias son la siguiente capa de maduración, no una omisión ignorada.»

---

### Integración continua (CI)

**Qué es (breve):** La CI automatiza compilación y pruebas en cada cambio relevante del repositorio, detectando regresiones antes de despliegue.

**En Escuela Pass:** Pipeline del **backend**: compila el servicio y ejecuta la suite **E2E contra PostgreSQL 16**. **No** existe aún un gate equivalente para compilar/lint del **frontend** —limitación reconocida en conclusiones y capítulo 7.

**Si preguntan:** «El backend tiene CI con E2E en PostgreSQL 16; el frontend es la brecha priorizada para trabajo futuro.»

---

### RNF4 y prueba de carga simulada

**Qué es (breve):** **RNF4** en el TDG es un requerimiento no funcional de **tiempo de respuesta** (umbral orientativo ~2 segundos). La **prueba de carga simulada** ejercita el API bajo concurrencia moderada para obtener un **indicio técnico** de rendimiento, no una certificación de producción multisitio.

**En Escuela Pass (cierre académico):**
- Catálogo **241** operaciones; **224/224** sondeadas (**17** DELETE omitidos para no alterar semilla)
- **72** lecturas GET válidas en sondeo; p95 sondeo **~37 ms** (p50 **~9 ms**)
- Carga concurrente: **10** clientes × **30 s** → **6 376** peticiones; p95 **~175 ms**; **100 %** bajo 2 s
- Entorno: integración local con PostgreSQL 16 y datos equivalentes a E2E

**Si preguntan:** «La carga simulada es un indicio RNF4 en laboratorio de integración; complementa E2E y CI, pero no sustituye piloto institucional ni hipótesis cuantitativas de la propuesta.»

---

### Fórmula de Haversine (circuito familiar)

**Qué es (breve):** Haversine calcula la **distancia entre dos puntos** en la superficie terrestre a partir de latitud y longitud, en línea recta sobre la esfera (no ruta de carretera).

**En Escuela Pass:** El padre/tutor envía actualizaciones GPS desde el navegador. El **servidor** calcula Haversine al procesar parches de posición del circuito —no solo el cliente— para validar proximidad y mantener consistencia de reglas de negocio.

**Si preguntan:** «Haversine vive en el backend del circuito: la distancia relevante para el negocio la decide el servidor, no un valor manipulable solo en el teléfono.»

---

### QR, NFC y Web NFC API

**Qué es (breve):** **QR** es un código bidimensional escaneable por cámara. **NFC** permite lectura por proximidad de chip. **Web NFC API** expone NFC al navegador donde el fabricante y el navegador lo permiten (soporte heterogéneo; limitaciones en iOS).

**En Escuela Pass:** Portería y aula usan **html5-qrcode** (cámara), **qrcode.react** (mostrar credencial) y **Web NFC** cuando está disponible. El escaneo llama al endpoint de eventos de acceso; la validez se resuelve **en servidor**.

**Si preguntan:** «QR y NFC son medios de identificación rápida en plantel; la credencial no se confía por sí sola: el servidor valida estado, rol y reglas antiduplicación.»

---

### Degradación elegante (graceful degradation)

**Qué es (breve):** Diseño en el que **servicios opcionales** (mapas, correo, *push*) pueden fallar o faltar sin impedir el arranque ni el núcleo transaccional del producto.

**En Escuela Pass:** **FCM** (notificaciones), **SMTP** (correo) y **Mapbox** (mapas) son opcionales. Si faltan credenciales en variables de entorno, el backend **arranca igual** y los flujos centrales continúan (el mapa puede degradar a enlace OSM o mensaje informativo).

**Si preguntan:** «Las integraciones externas son mejoras, no dependencias duras: el producto demostrable funciona sin ellas.»

---

### LFPDPPP e INAI (México)

**Qué es (breve):** La **LFPDPPP** (México, 2010) regula datos personales en posesión de particulares. El **INAI** emite lineamientos y orienta derechos ARCO, transparencia y responsabilidad del tratamiento.

**En Escuela Pass:** El software **instrumenta** apoyos técnicos: políticas de privacidad **versionadas**, **aceptaciones con marca temporal**, **auditoría** de actos sensibles, **minimización por rol**. **No** sustituye al responsable del tratamiento ni la redacción jurídica del aviso de privacidad.

**Si preguntan:** «El sistema materializa diligencia técnica alineada a LFPDPPP/INAI; la interpretación legal y el texto definitivo son responsabilidad institucional con su asesoría.»

---

### Correspondencia texto–código

**Qué es (breve):** Principio metodológico del TDG: lo afirmado en el documento debe poder **contrastarse** con artefactos versionados —entidades, rutas HTTP, pruebas— sin contradicción.

**En Escuela Pass:** **49 entidades** en código ↔ modelo ER del capítulo 4; **241 rutas** ↔ catálogo REST; **47 E2E** ↔ flujos críticos declarados; cifras del panel de hechos verificables en el repositorio.

**Si preguntan:** «El aporte metodológico central es que el jurado puede auditar entidades, rutas y E2E contra el texto, no solo leer afirmaciones.»

---

### Scrum y trazabilidad OE1–OE5

**Qué es (breve):** **Scrum** es un marco ágil con iteraciones (*sprints*), *backlog* priorizado y entregas incrementales. En un TDG, ordena el desarrollo sin confundirse con un piloto estadístico en campo.

**En Escuela Pass:** Iteraciones semanales; **cinco fases** alineadas a **OE1–OE5** (análisis, diseño, backend, frontend, validación). Las **siete fases** de la propuesta original (incluidas despliegue y evaluación) **no desaparecieron**: despliegue cruza OE3–OE4; evaluación con usuarios queda planificada en OE5 y piloto futuro.

**Si preguntan:** «Scrum estructuró entregas verificables; las siete fases de la FTG están mapeadas a los cinco objetivos sin acortar el ciclo de vida.»

---

# Parte B — Preguntas y respuestas por tema

Formato: **P** = pregunta · respuesta **corta** primero · **extendida** si profundizan.

---

## Bloque 1 — Problemática y aporte

#### P1. ¿Por qué el caso de estudio es México si usted gradúa en Colombia?

**Respuesta corta:** El ámbito de aplicación aprobado en la propuesta son **instituciones privadas en México**; el grado se sustenta en el Politécnico, pero el **problema operativo y la normativa de referencia** (LFPDPPP/INAI) son mexicanos. Colombia se documenta como horizonte de expansión (Ley 1581), no como despliegue ejecutado en este grado.

**Respuesta extendida:** La empresa AlfaNetworks y la formulación FTG orientan el producto al contexto escolar mexicano: portería, circuito familiar, LFPDPPP. El diseño técnico (RBAC, privacidad versionada, auditoría) es portable, pero los textos legales y la validación en plantel mexicano son el núcleo. Graduar en Apartadó no obliga a cambiar el caso de estudio si el TDG delimita geografía explícitamente (sección 1.1.6).

**Datos / ejemplo concreto:** Pregunta de investigación literal menciona «instituciones educativas privadas de **México**».

**Evitar decir:** «Hice el sistema para Colombia» (contradice el TDG).

---

#### P2. ¿Qué aporta Escuela Pass frente a plataformas comerciales como Skolable o similares?

**Respuesta corta:** Replica la **orientación integral** del sector, pero con tres diferencias defendibles en un grado de **ingeniería**: contrato HTTP explícito (**241** operaciones auditables), circuito físico **QR/NFC** enlazado a registros institucionales, y **evidencia reproducible** (migraciones, E2E, CI) en repositorio abierto al jurado —no una caja negra SaaS.

**Respuesta extendida:** Las plataformas comerciales resuelven comunicación y gestión, pero el jurado no puede auditar su código. Este trabajo aporta un caso completo de especificación trazable, arquitectura modular y validación automatizada contrastable. No afirmamos superioridad comercial en UX o precio; afirmamos **transparencia ingenieril** y dominios críticos de seguridad física integrados.

**Evitar decir:** «Somos mejores que Skolable en todo.»

---

#### P3. ¿El software sustituye el criterio pedagógico o la asesoría jurídica de la escuela?

**Respuesta corta:** **No.** Escuela Pass **instrumenta** protocolos y registros; las decisiones pedagógicas y la interpretación legal del responsable del tratamiento siguen siendo humanas e institucionales.

**Respuesta extendida:** En portería, el personal conserva autoridad en casos excepcionales. En privacidad, el sistema registra aceptaciones y auditoría, pero no redacta ni sustituye el aviso de privacidad ni la política interna validada por abogados. En finanzas, no hay pasarela automática: hay **revisión humana** de comprobantes.

**Si preguntan:** Citar explícitamente exclusiones del alcance (capítulo 3.5).

---

#### P4. ¿Por qué es un problema que merece un trabajo de grado y no solo una app más?

**Respuesta corta:** Porque combina **seguridad física**, **datos sensibles de menores**, **coordinación familiar** y **administración transaccional** en un solo producto **trazable**, con **241** operaciones, **49** entidades y validación automatizada —no una pantalla aislada.

**Respuesta extendida:** La Tabla 1 del capítulo 1 articula seis pares causa–consecuencia institucionales. La fragmentación no es un inconveniente menor: afecta auditoría, LFPDPPP y operación en horarios críticos. El TDG cierra con correspondencia texto–código y límites honestos, propio de ingeniería de producto regulado.

---

#### P5. ¿Cuál es la novedad o aporte académico concreto?

**Respuesta corta:** Un caso **empresa–academia** completo con **correspondencia texto–código**, arquitectura modular verificable y evidencia E2E/CI, aplicado a seguridad escolar y LFPDPPP en México.

**Respuesta extendida:** No se reclama publicación ni patente. Se reclama rigor de ingeniería informática: IEEE 830 en requisitos, REST/OpenAPI en contrato, ISO 25010 discutida con evidencia, Scrum con trazabilidad OE. El jurado puede contrastar afirmaciones con el repositorio.

---

## Bloque 2 — Objetivos y metodología

#### P6. ¿Cumplió el OE1 si la propuesta pedía estudio de campo en instituciones?

**Respuesta corta:** OE1 se cumple en su **núcleo documental y de alineación con AlfaNetworks**: RF/RNF, actores y reglas trazables. El **estudio estadístico en planteles** queda **diferido al piloto institucional** —límite reconocido en conclusiones, no negación del objetivo.

**Respuesta extendida:** La propuesta menciona reuniones con empresa e instituciones. En el tiempo del grado se consolidó especificación verificable y actas de alineación empresarial. La validación cuantitativa en campo no se declara cerrada. En sustentación: «OE1 cumplido en especificación y lenguaje común; la validación empírica masiva es fase posterior.»

**Evitar decir:** «Cumplí OE1 al 100 % incluyendo campo.»

---

#### P7. ¿Por qué cinco objetivos específicos si la propuesta hablaba de siete fases?

**Respuesta corta:** Los **cinco OE** son los objetivos **formales** de la FTG. Las **siete fases** del discurso de propuesta se **mapean** a esos cinco: despliegue es transversal en OE3–OE4; evaluación con usuarios está en OE5 y piloto futuro.

**Respuesta extendida:** El capítulo 2 (Tabla 2b) evita la ambigüedad de «fases eliminadas». Despliegue PaaS, migraciones y *health checks* son condición de entrega del backend/frontend. SUS y métricas de campo están planificadas; la prueba técnica E2E y la carga simulada cubren el núcleo de validación ingenieril al cierre del grado.

---

#### P8. ¿Scrum en un trabajo de grado individual tiene sentido?

**Respuesta corta:** Sí como **marco de iteración**: *backlog* priorizado, entregas semanales, revisión con asesor y contraparte AlfaNetworks. No implica equipo grande; estructura el incremento verificable.

**Respuesta extendida:** Cada sprint cerraba con trazabilidad RF/RNF, migraciones si cambiaba el modelo, y extensión de E2E en flujos críticos. Scrum ordena el «cómo» del desarrollo; no reemplaza la evaluación académica del jurado.

---

#### P9. ¿La pregunta de investigación quedó respondida?

**Respuesta corta:** **Afirmativa con matices:** sí hay un camino técnico viable demostrado; los porcentajes de mejora global de la propuesta requieren **piloto medido**.

**Respuesta extendida:** El «cómo» está materializado: NestJS, PostgreSQL, QR/NFC, 241 REST, controles de seguridad documentados, apoyos LFPDPPP instrumentados. El matiz: optimización cuantitativa (−35 %, ROI) son **hipótesis**, no resultados cerrados (Tabla A, sección 5.4).

---

#### P10. ¿Por qué no midieron las hipótesis de ahorro de la propuesta (−35 %, ROI, etc.)?

**Respuesta corta:** Porque requieren **muestra longitudinal en instituciones piloto** fuera del alcance temporal del grado. En el TDG se **recuperan como hipótesis** con plan de instrumentación, no como resultados ejecutados.

**Respuesta extendida:** Mezclar hipótesis económicas con evidencia E2E sería sobreprometer. El contraste honesto del capítulo 5: OE5 se cumple con prueba técnica automatizada, no con evidencia contable de ROI a 12 meses.

**Evitar decir:** «Ahorramos 40 % de tiempo» sin datos de piloto.

---

## Bloque 3 — Arquitectura y diseño

#### P11. ¿Por qué NestJS y no Express, Laravel o Django?

**Respuesta corta:** Porque el stack aprobado y el equipo de producto apuntan a **TypeScript + Node** en un dominio transaccional modular. NestJS aporta estructura (**módulos, DI, guards**) que Express deja más abierta, reduciendo deriva en un proyecto de **37 módulos**.

**Respuesta extendida:** Laravel/Django serían válidos en otro contexto; aquí la coherencia es **TypeScript end-to-end** (backend + frontend), OpenAPI nativo, y despliegue PaaS con proceso Node vivo. La decisión está documentada como motivo–problema–beneficio (sección 2.5).

---

#### P12. ¿Por qué PostgreSQL y no MongoDB u otra NoSQL?

**Respuesta corta:** El dominio escolar es **fuertemente relacional**: matrículas, cargos, asistencias, circuitos, pagos con integridad referencial. PostgreSQL con TypeORM y migraciones versionadas encaja con auditoría y consistencia transaccional.

**Respuesta extendida:** Finanzas, nómina y asistencias duales no se prestan bien a un documento único sin joins complejos. El modelo ER de 49 entidades refleja esa naturaleza.

---

#### P13. ¿Cómo escala el sistema? ¿Un solo servidor basta?

**Respuesta corta:** Al cierre del grado el despliegue demostrable es **PaaS con instancia de servicio + PostgreSQL gestionado**. La arquitectura **stateless** en API (JWT) permite réplicas horizontales del servicio; el límite actual es *lockout* en memoria y excepción ADMIN —documentados como supuestos de despliegue.

**Respuesta extendida:** Escalar no fue hipótesis medida en carga multisitio. La prueba de carga simulada da indicio bajo concurrencia moderada en laboratorio. Producción multisitio exigiría Redis para *lockout*, revisión de sesiones y estrés en campo.

---

#### P14. ¿Qué es OpenAPI y para qué lo usan?

**Respuesta corta:** OpenAPI es un estándar para describir APIs REST (endpoints, parámetros, respuestas). En Escuela Pass, Swagger/OpenAPI **3.1** documenta el contrato; en producción la UI interactiva puede deshabilitarse por política de seguridad.

**Respuesta extendida:** Facilita auditoría del jurado y alinea cliente, E2E y documentación. Trabajo futuro: archivar YAML por *release* con checksum (capítulo 7).

---

#### P15. ¿Por qué PaaS y no servidor propio o hosting PHP?

**Respuesta corta:** El producto requiere un **proceso Node.js continuo** y PostgreSQL administrado; el hosting PHP clásico no encaja con el runtime. PaaS reduce fricción académica para demostración con secretos parametrizados.

**Respuesta extendida:** Decisión explícita en sección 2.5(a): motivo técnico, problema de despliegue académico, beneficio de entorno realista (Railway u equivalente).

---

## Bloque 4 — Seguridad y datos personales

#### P16. ¿Por qué guardan JWT en localStorage y no en cookies httpOnly?

**Respuesta corta:** Por **simplicidad de SPA estática** sin capa BFF en el alcance del grado. Es una **deuda documentada**: mayor exposición teórica a XSS que cookies httpOnly + SameSite.

**Respuesta extendida:** El cliente Axios centraliza acceso y *refresh*. Mitigación futura: BFF, cookies endurecidas, CSP estricta (recomendación capítulo 7). No se oculta el riesgo; se declara el *trade-off*.

**Evitar decir:** «Es totalmente seguro así.»

---

#### P17. ¿Qué riesgo implica la excepción operativa del rol ADMIN de plataforma?

**Respuesta corta:** El rol **ADMIN** puede atravesar límites de escuela para soporte multiinstitución. Es **necesario operativamente** pero concentra poder: exige confianza, políticas internas y eventual endurecimiento en despliegue productivo.

**Respuesta extendida:** Está documentado como riesgo residual, no como vulnerabilidad ignorada. En producción institucional se acotaría auditoría, MFA o cuentas de soporte separadas.

---

#### P18. ¿Cómo ayuda el sistema con LFPDPPP sin ser abogado?

**Respuesta corta:** Provee **mecanismos técnicos**: políticas versionadas, registro de aceptaciones con timestamp, auditoría, acceso por rol y minimización de datos mostrados según perfil.

**Respuesta extendida:** LFPDPPP exige responsable del tratamiento, finalidades y derechos ARCO. El software registra evidencia de diligencia; la institución define textos y procedimientos. Analogía: un sistema contable no sustituye al contador, pero deja rastro auditable.

---

#### P19. ¿Qué pasa si alguien fotocopia o clona el QR de un estudiante?

**Respuesta corta:** El QR/NFC es un **medio de identificación**, no la autorización final. El servidor valida credencial, estado del usuario, escuela, ventana antiduplicación y contexto. Personal humano interviene en excepciones.

**Respuesta extendida:** Compartir dispositivo o credencial visual sigue siendo riesgo operativo (como una tarjeta física perdida). Mitigaciones: revocación de credencial, auditoría de eventos, roles en portería, políticas institucionales. No se promete biometría de alta seguridad (excluida del alcance).

---

#### P20. ¿Qué medidas OWASP aplicaron?

**Respuesta corta:** Validación de entrada (class-validator), **throttling**, **Helmet** (cabeceras), hash **bcrypt**, consultas parametrizadas vía ORM, validación binaria de *uploads*, separación buckets público/privado, respuestas HTTP coherentes.

**Respuesta extendida:** Persiste riesgo XSS por tokens en navegador. STRIDE se usa como lectura crítica del diseño. OWASP no se invoca como «certificación», sino como línea pragmática aplicada.

---

#### P21. ¿Los datos de menores tienen tratamiento especial en el diseño?

**Respuesta corta:** Sí en enfoque: minimización por rol, consentimientos donde aplica el circuito, auditoría, sin exposición innecesaria en canales informales. El peso ético es mayor porque la población incluye NNA.

**Respuesta extendida:** Pantallas justifican finalidad visible; el responsable del tratamiento define bases legales. El TDG no sustituye política de retención institucional.

---

## Bloque 5 — Flujos de negocio

#### P22. ¿Por qué el padre opera el circuito y no un conductor o transporte escolar interno?

**Respuesta corta:** Por alineación con la **práctica real** en escuelas privadas urbanas: el adulto responsable inicia la recogida desde su móvil. Evita un módulo de flota/conductores fuera del alcance negociado con AlfaNetworks.

**Respuesta extendida:** La propuesta FTG mencionaba circuito «vial»; la reinterpretación operativa (caja en capítulo 4) documenta motivo, problema y beneficio. Las reglas —un circuito activo por estudiante por día, estados explícitos— siguen siendo ejecutables y probadas en E2E.

---

#### P23. ¿Cómo funciona la ventana antiduplicación de ~10 segundos en el escaneo?

**Respuesta corta:** Si el mismo usuario escanea dos veces en la misma escuela dentro de ~**10 s**, la API responde **201** con `duplicate=true` **sin insertar otro evento**. Evita doble conteo por rebote del lector o doble tap.

**Respuesta extendida:** No bloquea un segundo ingreso legítimo después de la ventana. Puede disparar marcación de asistencia diaria en ingreso válido de alumno con gracia configurable (`ATTENDANCE_ENTRY_GRACE_MINUTES`).

---

#### P24. ¿Por qué no integraron pasarela de pago automática?

**Respuesta corta:** Está **explícitamente fuera del alcance** (capítulo 3.5): el flujo de cartera usa **registro y verificación humana** de comprobantes, coherente con operación escolar real y menor riesgo PCI en el grado.

**Respuesta extendida:** No es omisión por incapacidad técnica; es delimitación de MVP académico. Integración bancaria sería proyecto aparte con implicaciones legales y de seguridad.

---

#### P25. ¿Cómo se garantiza una sola solicitud de circuito activa por estudiante por día?

**Respuesta corta:** Regla de negocio en el **servidor** al crear o activar solicitudes de circuito; el cliente no puede saltársela manipulando solo la UI.

**Respuesta extendida:** Forma parte de las reglas publicadas en requisitos y se ejercita en flujos E2E del dominio circuito.

---

## Bloque 6 — Validación, resultados y límites

#### P26. ¿Cumplió el OE5 si no hubo usuarios piloto ni encuesta SUS?

**Respuesta corta:** OE5 se cumple en su **núcleo de validación técnica**: **47 E2E**, CI en PostgreSQL 16, indicio RNF4 por carga simulada, plan de medición para SUS y piloto. La **usabilidad con usuarios finales** queda **pendiente** —no se niega, se diferencia.

**Respuesta extendida:** La redacción literal de la FTG menciona usuarios piloto; la defensa honesta es «validación técnica reproducible cerrada; evaluación con usuarios en fase institucional posterior». Esto coincide con conclusiones capítulo 6.

**Evitar decir:** «Los usuarios dijeron que es muy usable» sin datos.

---

#### P27. ¿La prueba de carga demuestra que cumplen RNF4 en producción?

**Respuesta corta:** **No del todo.** Demuestra un **indicio técnico** en entorno de integración: **100 %** de respuestas bajo 2 s en la corrida documentada, con p95 ~175 ms bajo concurrencia moderada. **No** sustituye medición en plantel real ni estrés multisitio.

**Respuesta extendida:** Complementa E2E y CI. Limitaciones capítulo 5.5: no es stress test de producción endurecida; lockout en memoria asume despliegue consciente.

**Datos:** 6 376 peticiones, 72 GET válidos, 224/224 sondeo contractual.

---

#### P28. ¿Por qué tantas pruebas E2E y tan pocas unitarias?

**Respuesta corta:** Porque el riesgo principal es **integración entre dominios** y regresión del **contrato HTTP** con PostgreSQL real. Las E2E son costosas pero fieles al fallo real. Las unitarias en Haversine, deudas y máquinas de estado son la **siguiente capa** (capítulo 7).

**Respuesta extendida:** En finanzas y circuito, E2E lentas detectaron bugs que unitarias aisladas habrían encontrado más rápido —deuda reconocida. No es ideal a largo plazo; es estrategia coherente con tiempo de grado y producto integrado.

---

#### P29. ¿Qué garantiza que las 241 rutas funcionan si E2E no cubren todas?

**Respuesta corta:** Las E2E cubren un **subconjunto representativo** de flujos críticos; el **sondeo contractual** de la prueba de carga alcanzó **224/224** operaciones con respuesta HTTP esperable. Son evidencias **complementarias**, no barrido funcional exhaustivo de cada escritura con payload completo.

**Respuesta extendida:** Muchas escrituras en sondeo devuelven 400/403/404 sin cuerpo de negocio completo —coherente con barrido de contrato, no prueba funcional total.

---

#### P30. ¿Cuál es el resultado más importante que debe quedarse el jurado?

**Respuesta corta:** Un producto **demostrable y trazable** que reduce fragmentación operativa en un canal único, con evidencia automatizada y respuesta **afirmativa con matices** a la pregunta de investigación.

**Respuesta extendida:** No es el porcentaje de ahorro prometido en la FTG; es la viabilidad técnica documentada con 241 REST, 47 E2E, arquitectura modular y límites explícitos.

---

## Bloque 7 — Trabajo futuro y cierre

#### P31. ¿Qué haría primero después de graduarse?

**Respuesta corta:** **CI del frontend** y **piloto institucional medido** (SUS + métricas de campo), en paralelo con endurecimiento de sesión (httpOnly/BFF) según prioridad del producto.

**Respuesta extendida:** Orden sugerido en capítulo 7 por retorno vs riesgo residual: CI cliente → sesión endurecida → piloto en dos escuelas medianas → unitarias en lógica crítica.

---

#### P32. ¿Cuál es la relación con AlfaNetworks? ¿Ellos son dueños del software?

**Respuesta corta:** AlfaNetworks es **caso de estudio y contexto empresarial** de alineación de requisitos. Según el capítulo 8 del TDG, **no hay cesión contractual** de derechos patrimoniales a AlfaNetworks por este trabajo de grado; el autor conserva titularidad salvo autorización académica al POLI JIC.

**Respuesta extendida:** Hubo reuniones para priorizar funcionalidades; el producto es entregable académico verificable. Comercialización futura es decisión del autor (licencia propietaria en repositorio).

**Evitar decir:** Detalles incorrectos sobre contratos inexistentes; ceñirse al TDG capítulo 8.

---

#### P33. ¿El producto está listo para producción en una escuela real?

**Respuesta corta:** Está **técnicamente demostrable** y desplegable con migraciones, CI y documentación; «producción institucional plena» exige piloto, endurecimiento de sesión, políticas jurídicas locales y operación acordada con la escuela.

**Respuesta extendida:** Es un grado de ingeniería, no certificación de SaaS productivo. Las limitaciones están declaradas; el camino a producción está trazado en capítulo 7.

---

# Parte C — Preguntas difíciles o «trampa»

#### D1. «Entonces su trabajo no validó usabilidad ni impacto real en escuelas.»

**Respuesta corta:** Correcto en **impacto cuantitativo y usabilidad SUS en campo** —eso está **pendiente de piloto**. Incorrecto si se niega el valor del grado: validamos **correctitud técnica reproducible**, arquitectura integral y un camino viable documentado.

**Respuesta extendida:** Un TDG de Ingeniería Informática con producto verificable aporta evidencia de ingeniería, no estudio longitudinal de ROI. La honestidad fortalece la credibilidad. Cierre: «El siguiente paso natural es piloto institucional medido.»

---

#### D2. «¿No es solo un CRUD escolar más?»

**Respuesta corta:** No es un CRUD de una tabla: son **dominios acoplados** —portería QR/NFC con antiduplicación, circuito con GPS y Haversine en servidor, cartera con verificación humana, privacidad versionada, multiinstitución— con **241** operaciones y **47** E2E.

**Respuesta extendida:** La complejidad está en reglas transversales, seguridad y trazabilidad LFPDPPP, no en pantallas de alta. Invitar al jurado a contrastar `access-events/scan` y `circuit-requests` con un CRUD genérico.

---

#### D3. «El evaluador pidió prueba de carga; ¿inventó los números?»

**Respuesta corta:** Los números provienen de una **ejecución documentada** al cierre académico (capítulo 5.4): entorno PostgreSQL 16 con semilla equivalente a E2E, catálogo 241 rutas, métricas de sondeo y concurrencia reproducibles. No se presentan como resultado de piloto en plantel.

**Respuesta extendida:** Si preguntan por scripts: la reproducibilidad está en el repositorio para fines académicos; el TDG describe el **protocolo y resultados**, no sustituye una auditoría externa. Ofrecer mostrar reporte o consola si el jurado lo pide.

**Evitar decir:** «Medimos ROI en escuelas con esa prueba.»

---

#### D4. «¿Colombia o México — dónde aplica legalmente su sistema?»

**Respuesta corta:** **México** como despliegue de referencia (**LFPDPPP/INAI**). **Colombia** (Ley 1581) como expansión documentada: el núcleo técnico es portable, pero textos legales y responsable del tratamiento deben adaptarse con asesoría local.

**Respuesta extendida:** Graduar en POLI JIC no cambia el caso México-primero aprobado en la FTG. Evitar mezclar obligaciones jurídicas de dos países en una sola afirmación.

---

#### D5. «¿Qué pasa si en la demo en vivo algo falla?»

**Respuesta corta:** Tengo **evidencia grabada y repositorio reproducible**; la demo es complementaria. Si falla, explico entorno (BD local, credenciales, puerto) y remito a **E2E en CI** como prueba automatizada que sí corre en cada build.

**Respuesta extendida:** Tener PostgreSQL local `escuela_pass_test`, backend compilado y usuario de prueba documentado. Si no hay red, mostrar video o resultados de carga. Mantener calma: un fallo de demo no invalida 47 E2E si se explica el contexto.

---

# Checklist — noche anterior a la defensa

Marca mentalmente cada ítem:

- [ ] **Cifras clave:** 241 REST · 47 E2E · 49 entidades · 39 migraciones · 5 roles · 37 módulos · 32 controladores
- [ ] **Carga simulada:** 224/224 sondeo · 72 GET · 6 376 req · p95 ~175 ms · 100 % &lt; 2 s · *indicio*, no piloto
- [ ] **Respuesta a la pregunta de investigación:** afirmativa **con matices**
- [ ] **OE1:** especificación sí · estudio estadístico en planteles **pendiente**
- [ ] **OE5:** E2E + CI + carga sí · SUS/usuarios piloto **pendiente**
- [ ] **Límites honestos:** JWT en navegador · sin CI frontend · sin ROI/% FTG medidos · lockout en memoria
- [ ] **No sustituye:** criterio pedagógico · asesoría jurídica · pasarela automática
- [ ] **Padre/tutor** opera el circuito (no conductor interno)
- [ ] **Haversine en servidor** · **validación QR/NFC en servidor**
- [ ] **Una frase de cierre:** «Camino técnico demostrado; cuantificación institucional es el siguiente paso.»

---

*Documento de preparación — no proyectar literalmente en diapositivas. Complementa `presentation-final-defense-en.md` (guion de exposición).*
