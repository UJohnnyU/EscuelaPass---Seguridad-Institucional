# ESCUELA PASS — ADMINISTRACIÓN Y SEGURIDAD ESCOLAR

## TRABAJO DE GRADO

**Modalidad:** Ingeniería Informática  
**Área curricular:** Programas Informáticos y Telecomunicaciones (APIT)  
**Facultad de Ingenierías**  
**Politécnico Colombiano Jaime Isaza Cadavid**  
**Medellín, 2026**

**Autor:** Jhon Kevin Murillo Martínez  
**Tutor:** (según constancia institucional)  
**Empresa vinculada al caso de estudio:** AlfaNetworks  

---

## DEDICATORIA Y AGRADECIMIENTOS

*(Insertar en la versión formal según normas del programa. Este cuerpo documental puede omitir dedicatorias si la plantilla institucional las declara opcionales para el archivo electrónico previo a impresión.)*

---

## TABLA DE CONTENIDO

*(Generar en Microsoft Word mediante referencias; los títulos siguientes corresponden a los estilos de título propuestos.)*

1. Resumen  
2. Abstract  
3. Introducción  
4. Planteamiento del problema  
5. Objetivos  
6. Marco de referencia  
7. Metodología  
8. Análisis y diseño del sistema  
9. Implementación  
10. Pruebas, validación y resultados  
11. Evolución del producto y operación  
12. Conclusiones  
13. Recomendaciones  
14. Referencias  
15. Lista de figuras y tablas  
16. Índice de anexos  

---

## RESUMEN

Escuela Pass es una aplicación web institucional para administración y seguridad escolar multiactor (familia, docentes, personal administrativo y operadores de plataforma). Cubre identidad y roles, acceso QR/NFC, circuito de recogida con apoyo de geolocalización, gestión académico–administrativa, cartera sin pasarela automática, comunicación y tableros con exportaciones; los RNF incluyen PostgreSQL, interfaz *responsive*, JWT con límites de tasa y despliegue en nube Node.js.

El circuito familiar lo opera el padre o tutor desde su dispositivo; la institución valida salidas y protocolos. La ubicación apoya mapas y ETA sin reemplazar autorizaciones explícitas.

El desarrollo priorizó trazabilidad RF/RNF→módulos→`api/v1`→UI bajo `/app`→E2E con PostgreSQL, 49 entidades en `buildTypeOrmConfig()`, migraciones y OpenAPI en `/docs` cuando aplica. El cuerpo sintetiza; los anexos 00–10 detallan inventarios. Limitaciones: sesión en navegador, pirámide de pruebas sesgada a E2E, integraciones opcionales y RNF4 sin medición sustitutiva del diseño.

**Palabras clave:** seguridad escolar; circuito de recogida; control de acceso QR/NFC; API REST; NestJS; React; PostgreSQL; trazabilidad de requerimientos; pruebas E2E.

---

## ABSTRACT

Escuela Pass is a web application for institutional school administration and safety in a multi-stakeholder setting (families, teachers, administrative staff, and platform operators). The system implements JWT-based authentication, QR/NFC physical access, a family pickup circuit supported by geolocation, academic and roster management, fee management with manual voucher review (no automatic payment gateway), institutional communication with optional push notifications and administrative reporting workflows, and operational dashboards with exports. Non-functional goals cover PostgreSQL persistence, a responsive SPA, security controls including throttling, and cloud deployment suitable for a Node.js stack.

Business rules clarify the pickup circuit: parents or guardians drive the in-app flow while the school enforces institutional release protocols. Location data supports maps and arrival estimation and may record proximity to campus according to configuration, without replacing explicit authorizations. Engineering practice emphasizes traceability through a requirement-to-module-to-route-to-UI matrix, forty-nine TypeORM entities, a migration chain, and end-to-end tests executed with PostgreSQL. Executable API documentation is available via OpenAPI at `/docs` when enabled.

Residual limitations include browser-stored tokens, test-pyramid skew toward E2E, optional third-party integrations, and the need to record measured latency to substantiate performance claims. Detailed inventories and annexed evidence are provided in companion annex documents 00–10.

**Keywords:** school safety; pickup circuit; QR/NFC access; REST API; NestJS; React; PostgreSQL; requirements traceability; E2E testing.

---

## 1. INTRODUCCIÓN

Las instituciones educativas contemporáneas gestionan simultáneamente la formación académica, la convivencia, la seguridad física de estudiantes y adultos en el plantel, y relaciones complejas con familias que exigen información oportuna y canales confiables. Los sistemas digitales pueden concentrar parte de esa complejidad siempre que respeten fronteras legales y pedagógicas: tratamiento de datos personales, especialmente de niños, niñas y adolescentes; accesibilidad razonable de interfaces; y separación clara entre lo que el software automatiza y lo que sigue siendo decisión humana de la institución.

Escuela Pass responde a ese contexto como producto de trabajo de grado desarrollado en colaboración con **AlfaNetworks**. El sistema integra un backend **NestJS** con **PostgreSQL** y **TypeORM**, y un cliente **React** construido con **Vite** y estilado principalmente con **Tailwind CSS**, desplegados en configuración compatible con **Railway** para API y base de datos y con alojamiento estático para el *frontend*. La coordinación entre dominios —identidad, acceso físico, circuito familiar, nómina, finanzas escolares, comunicación y analítica operativa— se implementa mediante módulos de dominio registrados en `AppModule`, cada uno exponiendo controladores bajo el prefijo configurable `API_PREFIX`, documentalmente `api/v1`.

El texto desarrollado del trabajo de grado articula el **qué** y el **por qué** de la solución, mientras que los **anexos** concentran inventarios técnicos exhaustivos (rutas HTTP, tablas, diagramas, manual de usuario, informe de pruebas). Esta división obedece a las normas APIT de extensión y citación, y a la necesidad de que un tribunal académico pueda contrastar afirmaciones del cuerpo principal contra evidencia tabular y capturas sin obligar a transcribir en el capítulo central cada operación REST del producto.

La línea argumental del proyecto reconoce explícitamente un **alcance ampliado** respecto del texto mínimo histórico de la propuesta formal (multiinstitución, visitas externas, reuniones, anotaciones de atención, privacidad y auditoría ampliada, entre otros). Esas capacidades no reemplazan la numeración RF1–RF8, sino que la complementan y están tabuladas de forma consistente en el **Anexo 00** (sección 2.1) y en el **Anexo 01** (sección 3.2).

### 1.1. Delimitación del alcance y supuestos del caso de estudio

El trabajo asume que la institución educativa cuenta con responsables funcionales que definen políticas de salida, autorizaciones de terceros, calendarios y reglas financieras. Escuela Pass **instrumenta** esas políticas mediante flujos y validaciones en servidor; no prescribe pedagogía ni sustituye la función inspectiva de autoridades competentes. La **multiinstitución** permite operación de plataforma para varias sedes cuando el rol de administración de plataforma está habilitado; el detalle contractual de licencia y soporte corresponde al acuerdo entre la empresa vinculada y cada cliente institucional.

Se considera **explícito** el alcance del **RF6** sin pasarela de pagos automática: los comprobantes cargados por familias ingresan a revisión humana; la automatización se centra en estados, trazas, notificaciones y políticas de cartera donde estén implementadas. Las **integraciones opcionales** (correo saliente, notificaciones *push*, mapas) degradan el producto de forma controlada cuando faltan credenciales, lo cual es coherente con despliegues progresivos y con la necesidad de demostraciones académicas en laboratorio sin exponer llaves de terceros.

La **geolocalización** del circuito familiar se interpreta como apoyo contextual (mapas, estimaciones, proximidad parametrizable con radio). No constituye prueba legal única de entrega ni reemplaza la verificación institucional; su inclusión obedece a reducir fricción operativa y mejorar visibilidad para quien autoriza la salida, dentro de los límites de precisión del dispositivo y del consentimiento informado que la institución deba obtener conforme a su marco aplicable.

### 1.2. Contribución documental y técnica

La contribución del trabajo de grado combina **(a)** una especificación trazable de requerimientos institucionales, **(b)** una arquitectura de software modular alineada con dominios escolares reales y **(c)** evidencia de validación reproducible mediante compilación, pruebas de extremo a extremo con PostgreSQL e integración continua en el repositorio. La organización en **anexos** preserva inventarios extensos —por ejemplo, el catálogo de rutas HTTP y las tablas del modelo entidad–relación— fuera del cuerpo principal, de modo que el texto central puede leerse como narrativa académica sin perder el enlace puntual hacia la evidencia técnica.

Desde la perspectiva de ingeniería, el producto muestra cómo patrones comunes en aplicaciones empresariales (JWT, validación declarativa, ORM relacional, tareas programadas, módulos de auditoría) se **contextualizan** en un dominio regulado donde la población objetivo incluye menores y donde la trazabilidad de acciones sensibles es parte del valor entregado. Las limitaciones —sesión en navegador, dependencia de integraciones externas para ciertos flujos secundarios, pirámide de pruebas sesgada— se enuncian de forma explícita para que el lector pueda evaluar el alcance sin inferencias optimistas no soportadas por medición.

### 1.3. Organización del documento y lectura sugerida

El lector puede abordar el texto de dos maneras complementarias. Una lectura **lineal** sigue el orden convencional de un TDG APIT: introducción y problema, objetivos, marco teórico, metodología, análisis y diseño, implementación, pruebas, evolución operativa, conclusiones y recomendaciones, referencias, lista de figuras y anexos. Una lectura **orientada a evidencia** parte del **Anexo 00** y del **Anexo 10** para contrastar afirmaciones del cuerpo central con matrices y comandos reproducibles antes de sumergirse en la narrativa de diseño. Las remisiones a anexos usan la convención “**Anexo NN**” y “secc.” para localizar subapartados sin transcribirlos.

Los capítulos de **análisis** y **implementación** son los más extensos porque concentran decisiones técnicas que un tribunal suele cuestionar: arquitectura modular, modelo relacional, seguridad y estrategia de despliegue. El capítulo de **pruebas** enfatiza honestidad metodológica: qué está automatizado en CI, qué depende de ejecutar suites adicionales y qué permanece pendiente de medición de desempeño o de validación con usuarios piloto.

### 1.4. Innovación relativa y originalidad del aporte

La originalidad del trabajo no consiste en inventar el JWT ni el patrón MVC en *frontend* —componentes maduros y ampliamente documentados— sino en **orquestar** un dominio escolar heterogéneo con trazabilidad académica verificable. Muchos sistemas comerciales cerrados ofrecen módulos similares sin permitir inspeccionar contratos HTTP ni reproducir pruebas; aquí el repositorio actúa como **demostración pública** de decisiones, con el costo de mantener documentación alineada.

Otra faceta de originalidad es la **honestidad sobre límites**: declarar que RNF4 requiere medición, que el almacenamiento de sesión en navegador conlleva riesgos teóricos XSS y que el CI no cubre aún el *build* del cliente son afirmaciones que reducen espectacularidad superficial pero incrementan credibilidad técnica. En un trabajo de grado de ingeniería, esa postura suele valorarse por encima de un marketing funcional incompatible con el código.

Finalmente, el caso **RF6** sin pasarela y el **RF3** con operador familiar muestran sensibilidad a contexto latinoamericano de escuelas que aún supervisan pagos manualmente y que coordinan salidas con alta densidad de tráfico peatonal. Esas decisiones pueden no ser “novedosas” en literatura internacional, pero sí **pertinentes** al caso de estudio y defendibles ante un jurado que conoce la operación real del cliente.

---

## 2. PLANTEAMIENTO DEL PROBLEMA

El problema abordado es la **fragmentación operativa** entre herramientas de seguridad en el ingreso al plantel, la coordinación de salida con familias, la gestión académico–administrativa y los canales de comunicación. Cuando esos procesos dependen de hojas de cálculo dispersas, mensajería informal o sistemas inconexos, aumentan el riesgo de error humano, la latencia informativa y la dificultad de auditoría frente a incidentes o reclamos.

Escuela Pass plantea una **plataforma única** con navegación por rol, políticas de acceso coherentes en servidor y trazas persistidas (accesos, circuito, asistencia, finanzas, comunicación), de modo que la institución pueda reconstruir hechos relevantes sin depender exclusivamente de memoria operativa. El problema no se formula como sustitución total del criterio pedagógico ni del marco legal; el software **apoya** protocolos definidos por la institución y deja explícitas las limitaciones —por ejemplo, ausencia de pasarela bancaria automática en el alcance documentado, o **degradación controlada** cuando faltan integraciones opcionales como FCM, SMTP o Mapbox.

Un segundo aspecto del problema es la **gobernanza de datos personales**. Instituciones que manipulan datos de menores requieren mecanismos de consentimiento informado, registro de versiones de avisos de privacidad y, en escenarios de auditoría, correlación entre acciones sensibles y responsables. Escuela Pass incorpora dominios de privacidad y auditoría para soportar ese requisito; el fundamento jurídico aplicable al caso concreto debe consagrarse en el marco teórico y en la documentación legal institucional, alineado con la Ley 1581 de 2012 y normativa concordante cuando el caso de estudio corresponde a Colombia, sin confundir comentarios orientativos de código con el marco del trabajo escrito.

### 2.1. Preguntas orientadoras

El planteamiento puede sintetizarse en interrogantes que el desarrollo y la documentación buscan responder de manera verificable. ¿Cómo unificar autenticación, roles y permisos para actores escolares heterogéneos sin multiplicar silos de datos? ¿De qué modo registrar accesos físicos y transiciones del circuito de salida de forma **auditabile** por la institución? ¿Cómo ofrecer a familias canales móviles fiables sin comprometer la proporcionalidad del tratamiento de datos personales? ¿Qué contratos de API permiten evolucionar el *backend* y el *frontend* de forma relativamente independiente? ¿Qué evidencias automatizadas respaldan el cumplimiento funcional frente a cambios continuos en el repositorio?

### 2.2. Alcances excluidos o diferidos

Quedan **fuera** del núcleo del problema —salvo notas de extensión en anexos— la integración con pasarelas bancarias para débito automático, la identificación biométrica de alta seguridad en torniquetes, el análisis forense avanzado de dispositivos móviles y la certificación formal de un centro de datos. Asimismo, **cualquier** interpretación legal definitiva sobre tratamiento transfronterizo o normativa sectorial específica fuera del caso ilustrado corresponde a asesoría jurídica institucional, no al software por sí solo. El trabajo documenta capacidades técnicas de apoyo a gobernanza; la adopción de políticas y textos legales es responsabilidad de la contraparte educativa.

### 2.3. Contexto de la empresa vinculada y co-diseño con AlfaNetworks

La participación de **AlfaNetworks** como empresa vinculada al caso de estudio aportó un **puente** entre el aula y la práctica de desarrollo de producto: prioridades semanales, criterios de “listo para demostración” y validaciones de dominio que un proyecto puramente académico difícilmente replica. Esa relación también introdujo restricciones reales: tiempo disponible de *stakeholders*, necesidad de conservar un repositorio compartible con tutores, y la obligación ética de no exponer datos personales reales en capturas o en bases de datos de prueba compartidas.

El co-diseño no significó diluir responsabilidad académica del autor; significó **anclar** requerimientos a escenarios operativos plausibles. Por ejemplo, la comunicación con SLA y acuses en comunicados críticos —presente en actas recientes— responde a una preocupación genuina de dirección escolar: saber no solo que se emitió un aviso, sino que las partes relevantes tuvieron oportunidad de leer o confirmar en plazos acordados. Similarmente, la ausencia de pasarela en **RF6** refleja una decisión de alcance comprensible para instituciones que aún desean **control humano** sobre conciliación bancaria.

Desde el punto de vista metodológico, la convivencia empresa–academia exigió **formalizar** acuerdos en actas (**Anexo 02**) para que decisiones informales de reunión no se confundan con requerimientos basales citables. Esta formalización incrementó carga documental, pero redujo ambigüedad al cierre del ciclo de grado.

### 2.4. Brecha digital, soberanía de datos y soberanía operativa

Las instituciones educativas enfrentan simultáneamente presiones por **modernización** y por **control sobre sus propios datos**. Externalizar todo a un proveedor opaco puede acelerar la adopción pero reduce visibilidad de auditoría y fija costos recurrentes; internalizar todo sin competencias técnicas produce proyectos truncos. Escuela Pass representa un **punto intermedio**: un núcleo propio bajo control del repositorio, con posibilidad de despliegue en infraestructura alquilada pero con datos en instancia PostgreSQL dedicada.

La **soberanía operativa** —capacidad de reconstruir un incidente, exportar datos y cambiar de entorno de cómputo sin reescribir el sistema desde cero— fue un criterio tácito de diseño reflejado en scripts SQL de referencia, migraciones y documentación de variables. No se afirma independencia total de proveedores de nube; se afirma **reducibilidad de lock-in** relativa frente a soluciones propietarias cerradas sin API exportable.

---

## 3. OBJETIVOS

### 3.1. Objetivo general

Diseñar e implementar Escuela Pass, una aplicación web integral que soporte administración y seguridad escolar mediante autenticación por roles, control de acceso físico, circuito de recogida familiar, gestión institucional y académica, comunicación y reportes, con persistencia relacional, despliegue en nube y validación documentada frente a requerimientos funcionales y no funcionales.

### 3.2. Objetivos específicos

1. **Analizar y especificar** requerimientos RF1–RF8 y RNF1–RNF6, actores, reglas de negocio y alcance ampliado, consolidando trazabilidad en la matriz del **Anexo 00** y la especificación del **Anexo 01**.  
2. **Modelar la arquitectura** lógica y de despliegue del sistema, documentando *bounded contexts*, integraciones opcionales y riesgos residuales (**Anexo 03**).  
3. **Diseñar el modelo de datos** con entidades TypeORM y migraciones coherentes con PostgreSQL (**Anexo 04**).  
4. **Representar comportamiento** mediante diagramas UML de casos de uso, secuencia del circuito y vistas de contexto (**Anexo 05**).  
5. **Diseñar la interfaz** *responsive* e inventariar rutas del cliente React (**Anexo 06**), complementada con manual de usuario (**Anexo 09**).  
6. **Implementar** backend NestJS y frontend React/Vite, exponiendo contratos REST documentables con OpenAPI (**Anexo 08**).  
7. **Documentar** instalación, configuración, despliegue y mantenimiento (**Anexo 07**, `docs/technical-setup.md`).  
8. **Validar** el producto mediante pruebas E2E, *smoke*, pipeline de integración continua donde aplique, y plan de métricas para RNF4 y RNF5 (**Anexo 10**).  
9. **Registrar** acuerdos con la contraparte funcional en actas (**Anexo 02**).

### 3.3. Alineación entre propuesta formal, anexos y código

Los objetivos específicos responden a una **cadena de correspondencia** entre la propuesta formal (FTG), los anexos numerados y el repositorio. Cuando un objetivo menciona el **Anexo 04**, se espera que cualquier entidad nueva en `src/database/entities/` aparezca reflejada en el inventario tabular y que la migración asociada sea aplicable sin conflictos en entornos compartidos. Cuando el objetivo invoca el **Anexo 08**, la expectativa es que rutas nuevas o eliminadas alteren el catálogo o queden justificadas como *internal* fuera del contrato público. Esta alineación **no es automática**: requiere hábitos de equipo; por ello el objetivo de metodología y de matriz (**Anexo 00**) es transversal al resto.

La inclusión del objetivo relacionado con **actas** (**Anexo 02**) reconoce que, en proyectos con empresa vinculada, la trazabilidad no es solo técnica sino también gestional: decisiones de priorización —posponer una pasarela de pagos, habilitar multiinstitución, ampliar comunicación con SLA— quedan asentadas para evitar debates retrospectivos que confundan el alcance evaluado por un jurado académico.

### 3.4. Indicadores orientativos de cumplimiento

Para lectura académica, los objetivos pueden leerse junto a **indicadores** no contractuales pero útiles en defensa: existencia de matriz trazable (**Anexo 00**), catálogo OpenAPI accesible en entorno de demostración, ejecución verde de `npm run test:e2e` con registro, presencia de diagramas exportados en anexos gráficos y manual de usuario cubriendo roles principales (**Anexo 09**). Ningún indicador sustituye el juicio del tribunal, pero conjuntamente **orientan** la revisión hacia evidencia en lugar de impresiones.

---

## 4. MARCO DE REFERENCIA

### 4.1. Seguridad física y flujos institucionales en entornos escolares

La literatura y la práctica institucional coinciden en que la seguridad escolar combina factores humanos, procedimientos y tecnología. Los sistemas de control de acceso por credenciales digitales —códigos QR o identificadores NFC— reducen el uso exclusivo de credenciales visuales fáciles de falsificar, pero introducen nuevos riesgos: uso compartido de dispositivos, capturas de pantalla sensibles y necesidad de correlación entre lectura física e identidad digital. Escuela Pass mitiga en servidor la validez de credenciales, roles y contexto institucional; las políticas concretas de rotación de códigos y comunicación con familias permanecen competencia de la institución.

### 4.2. Protección de datos personales y población infantil

El tratamiento de datos de menores exige proporcionalidad, finalidad limitada, transparencia y mecanismos de consentimiento o autorización conforme al ordenamiento aplicable. En el marco colombiano, la Ley 1581 de 2012 y normas relacionadas establecen principios para el tratamiento de datos personales y deberes del responsable. El producto implementa **PrivacyGate** para bloquear el uso hasta aceptar la política vigente y mantiene registros de aceptación; el texto legal y la titularidad del tratamiento deben explicitarse en la documentación institucional del caso de estudio, evitando contradicciones con comentarios de código orientados a otros marcos.

### 4.3. Arquitecturas web modernas y separación cliente–servidor

Las aplicaciones de página única (SPA) facilitan experiencias responsivas y despliegue estático del cliente, pero trasladan parte de la superficie de seguridad al navegador. Escuela Pass almacena *tokens* de acceso y renovación en `localStorage`, patrón coherente con `Authorization: Bearer` pero con *trade-off* documentado en el **Anexo 03** (secc. 12.2): mayor sensibilidad a vectores XSS relativamente a cookies *httpOnly*. Las contramedidas del producto incluyen validación estricta con `ValidationPipe`, HTTPS en producción, límite global de peticiones con `ThrottlerGuard` y controles de archivos.

### 4.4. Estándares de documentación de API

La especificación **OpenAPI** permite a equipos y auditores contrastar contratos HTTP con implementación. Escuela Pass genera Swagger en tiempo de arranque; en producción la documentación interactiva permanece deshabilitada salvo configuración explícita (`ENABLE_SWAGGER`), minimizando superficie de ataque. El **Anexo 08** recoge dominios y catálogo inferido del código; ante discrepancia, prevalece la especificación viva.

### 4.5. Ingeniería de requisitos en sistemas institucionales multiactor

Los sistemas escolares comparten con otros dominios administrativos la heterogeneidad de perfiles y la sensibilidad de ciertos datos; se distinguen, sin embargo, por la presencia sistemática de menores como titulares indirectos y por la convivencia diaria de eventos físicos (ingreso, clases, salida) con registros digitales. La ingeniería de requisitos aplicada aquí priorizó **trazabilidad matricial**: cada capacidad relevante se vinculó a identificadores RF/RNF y, a través del **Anexo 00**, a módulos, rutas API y rutas de interfaz cuando correspondía. Esa disciplina reduce la deriva entre “intención de negocio” y “comportamiento desplegado”, frecuente cuando los equipos crecen o cuando múltiples releases suceden en ciclos cortos.

Asimismo, se adoptó el principio de **fuente primaria en código** para decisiones técnicas delicadas (por ejemplo, límites de tamaño de comprobantes, radio de llegada al plantel, política de *refresh* único). Los documentos narrativos citan esas decisiones con remisión al repositorio o a anexos, en lugar de reescribir valores que podrían desactualizarse. Esta práctica converge con la idea de **documentación como código**, útil tanto en entornos académicos —donde el tribunal puede inspeccionar commits— como en la transición hacia producto mantenible en empresa vinculada.

### 4.6. Seguridad de aplicaciones web y endurecimiento pragmático

La literatura de seguridad (p. ej., enfoques alineados con OWASP) enfatiza superficies como inyección, *broken authentication*, exposición de datos sensibles y configuración incorrecta. Escuela Pass incorpora medidas de **defensa en profundidad** razonables para un producto SPA: cabeceras endurecidas con Helmet, validators en DTO, *rate limiting* global con `@nestjs/throttler`, pruebas específicas de limitación en autenticación cuando se ejecuta la suite dedicada, y entrega de archivos privados solo tras autorización. El documento de arquitectura (**Anexo 03**) discute *trade-offs* de almacenamiento de *tokens* en `localStorage` frente a cookies *httpOnly*; el cuerpo principal solo recuerda la conclusión prudencial: **la combinación implementada es defendible en MVP con controles adicionalmente recomendados** (CSP, higiene XSS, consideración de *Backend-for-Frontend*) cuando la exposición operativa lo justifique.

### 4.7. Gestión de datos académico–financiera y reputación institucional

Los subsistemas de asistencia, calificación y cartera interactúan con la percepción de equidad y transparencia. Errores de consistencia —p. ej., permitir calificar en periodos cerrados, o exponer archivos de comprobantes sin chequeo de pertenencia— afectan la confianza más que un fallo cosmético del *frontend*. Por ello el diseño reforzó **reglas de negocio en servicios** y **pruebas de cierre** centradas en cruces de seguridad y estados límite (**Anexo 10**, especificación `phase7-closure`). Desde el marco de referencia, esta orientación es coherente con la literatura sobre calidad en sistemas informáticos aplicados a organizaciones: la verificación debe acompañar los flujos de mayor riesgo reputacional, no distribuirse uniformemente en rutinas triviales.

### 4.8. Digitalización institucional y expectativas de las familias

La adopción de canales digitales en educación no homogeniza contextos: una misma funcionalidad —notificaciones en tiempo casi real— puede percibirse como mejora en una comunidad y como carga adicional en otra si no existe acompañamiento pedagógico. Escuela Pass asume que las familias **desean** visibilidad sobre aspectos operativos (salida, deudas, avisos), pero esa visibilidad debe construirse con **mensajes claros** y con permisos que eviten la sobreexposición de datos entre hogares. El **Anexo 09** traduce estos principios a pasos concretos por rol; el marco teórico solo fija que la tecnología habilita, no sustituye, la comunicación ética de la institución.

### 4.9. Trabajos relacionados y línea base del producto

Sin pretender una revisión sistemática exhaustiva, el estado del arte aplicable incluye plataformas comerciales de gestión escolar, soluciones de control de acceso físico desalineadas del sistema académico, y mensajería instantánea informal fuera de políticas institucionales. Escuela Pass se distingue por **integrar en un solo contrato API** identidad, acceso, salida coordinada, operación académico–administrativa y flujos financieros revisados manualmente, con trazabilidad documentada. Los trabajos académicos comparables suelen profundizar un solo subdominio; aquí la complejidad es precisamente la **orquestación transversal**, lo que justifica la extensión del paquete anexo y la matriz del Anexo 00.

### 4.10. Ética del dato escolar, consentimiento y comunicación transparente

Más allá del cumplimiento legal, la dimensión **ética** del tratamiento de datos en escuelas exige preguntar por la **finalidad** de cada nueva pantalla. ¿Esta vista reduce riesgo físico o solo desplaza la ansiedad a los padres con exceso de notificaciones? ¿Este reporte administrativo preserva la dignidad del estudiante al evitar calificaciones sensibles fuera de contexto? El software por sí mismo no responde esas preguntas, pero puede **facilitar** prácticas mejores: permisos granulares, minimización de datos en exportaciones y registros de auditoría que inhiben usos oportunistas.

El **PrivacyGate** y los registros de política materializan un mínimo de **transparencia procedimental**: el usuario reconoce haber leído una versión específica antes de operar. La institución debe asegurar que el texto legal correspondiente sea veraz y comprensible para el público meta; de lo contrario, el *gate* se convierte en ritual burocrático sin valor ético real.

La comunicación a familias —avisos, recordatorios, *push*— debe balancear **oportunidad** con **no sobrecarga**. Existe literatura organizacional sobre fatiga digital que sugiere consolidar mensajes y respetar horarios. Escuela Pass ofrece mecanismos; la política de uso es responsabilidad humana.

### 4.11. Buenas prácticas operativas de datos en entornos educativos

Instituciones avanzadas en gobernanza de datos suelen adoptar principios de **minimización** (no recolectar campo extra “por si acaso”), **segmentación de acceso** (roles finos con revisión periódica) y **retención definida** (cuánto tiempo conservar logs y evidencias financieras). El software facilita el segundo principio mediante roles y rutas; el primero y el tercero dependen de política institucional explícita. Un TDG no puede resolver retención legal por sí solo, pero sí **advertir** que acumular eventos de acceso indefinidamente incrementa riesgos de exposición futura.

La **pseudonimización** o uso de datos sintéticos en entornos de prueba es parte de cultura de datos sana. El repositorio muestra bases de prueba separadas (`escuela_pass_test`); la institución debería replicar esa separación entre producción, *staging* y capacitación. Cuando se usen datos reales en piloto, los convenios de confidencialidad y las plantillas de consentimiento deben preceder a la captura de pantalla para el documento final.

### 4.12. Accesibilidad, inclusión y límites del MVP

La accesibilidad digital (**WCAG**) no fue objetivo primario explícito del MVP, pero el producto adoptó prácticas **mínimas** coherente con frameworks modernos: contraste razonable en *shell*, foco en formularios críticos, mensajes de error textuales. Una auditoría formal de accesibilidad queda como trabajo futuro alineado con **RNF5** y con valores institucionales de inclusión. Ignorar esta dimensión en trabajo futuro podría excluir a docentes o familias con necesidades específicas; el marco del TDG debe mencionarlo para evitar la ficción de neutralidad tecnológica.

---

## 5. METODOLOGÍA

### 5.1. Enfoque general

Se adoptó un proceso de ingeniería de software **iterativo e incremental**, alineado con el desarrollo de producto en entorno empresarial vinculado al caso de estudio. Cada incremento cerraba *backlog* funcional con trazabilidad a RF/RNF, actualización de migraciones cuando el modelo persistido cambiaba, y extensión o ajuste de pruebas E2E cuando el flujo era crítico para seguridad o académico–financiero.

### 5.2. Fuentes de verificación

La **fuente normativa interna** del proyecto es la propuesta formal (FTG) y sus interpretaciones consolidadas en el **Anexo 01**. La **fuente técnica primaria** es el repositorio: módulos en `src/modules/`, entidades en `src/database/entities/`, cliente en `frontend/src/`, configuración en `docs/technical-setup.md` y pruebas en `test/`. La **matriz del Anexo 00** actúa como puente obligatorio entre texto de requerimientos y evidencias de implementación.

### 5.3. Control de calidad y trazabilidad documental

Los cambios que afectan contratos públicos debían reflejarse coherentemente en **Anexo 04** (si tocan tablas), **Anexo 08** (rutas HTTP), **Anexo 06/09** (si tocan rutas UI) y **Anexo 10** (si alteran estrategia de prueba). Scripts de enriquecimiento documental (`npm run tdg:enrich` en el *backend*) apoyan inventarios pero no sustituyen el juicio de consistencia académica.

### 5.4. Herramientas

- **Node.js** ≥ 20, **TypeScript**, **NestJS 10**, **TypeORM 0.3.x**, **PostgreSQL 16** en CI y recomendado en producción.  
- **Jest** para pruebas unitarias y E2E (`test/jest-e2e.json`).  
- **React 18**, **Vite 6**, **Tailwind CSS**, escaneo **html5-qrcode**, mapas **Mapbox** cuando hay *token*.  
- **GitHub Actions**, flujo `Backend CI` en la raíz del repositorio remoto, con `working-directory: 01 - Escuela Pass`, servicio **PostgreSQL 16**, pasos `npm ci`, `npm run build`, `npm run test:e2e`.

### 5.5. Ciclo de trabajo y entregables incrementales

Cada iteración combinaba **diseño mínimo viable**, **implementación** y **verificación** cuando el flujo era sensible. Los cambios en tablas obligaban a planear el impacto en migraciones y, de ser posible, scripts de compatibilidad; los cambios en requerimientos de negocio debían reflejarse primero en la matriz del **Anexo 00** para evitar “funcionalidad huérfana” sin criterio de aceptación. La convivencia con empresa vinculada (**AlfaNetworks**) introdujo revisiones de priorización alineadas a *releases* documentados en actas (**Anexo 02**), sin sustituir el juicio académico sobre coherencia del TDG.

La práctica de *pull request* sobre rama `main` con CI automatizada redujo regresiones silenciosas: el servidor de integración compila el *backend* y ejecuta la suite E2E contra PostgreSQL, lo que constituye una barrera objetiva frente a cambios que rompen persistencia o contratos críticos. Esta barrera **no** agota la calidad —el *frontend* no forma parte del flujo actual— pero fija un piso reproducible descrito con honestidad en el **Anexo 10**.

### 5.6. Relación entre documentación académica y repositorio

El trabajo de grado se redactó para que el **cuerpo principal** sea legible sin abrir el repositorio, mientras los **anexos** absorben inventarios que de otro modo inflarían el capítulo central sin añadir síntesis. En sentido inverso, el código y las pruebas actúan como **árbitro** ante discrepancias: si una tabla del Anexo 04 describe una columna que ya no existe, o si el Anexo 08 lista una ruta eliminada, la corrección documental debe seguir al código o justificar una excepción temporal explícita. El script `npm run tdg:enrich` automatiza parte del mantenimiento de inventarios pero no reemplaza la revisión humana de redacción académica.

### 5.7. Gestión de riesgos del proyecto y amenazas a la validez

Los riesgos principales fueron **(i)** deriva entre documentación y código; **(ii)** dependencia de integraciones externas para demostraciones “completas”; **(iii)** tiempo finito de grado frente a ambición funcional; **(iv)** privacidad de menores en capturas y *logs*. Las mitigaciones incluyeron: matriz de trazabilidad obligatoria, modo degradado documentado para FCM/SMTP/Mapbox, priorización por actas con AlfaNetworks y uso de datos sintéticos en evidencias. En sentido epistemológico, una **amenaza a la validez** del capítulo de pruebas es inferir calidad general desde E2E que cubren subconjuntos del catálogo HTTP; el texto lo declara y remite al lector a la sección honesta del **Anexo 10** sobre cobertura parcial.

### 5.8. Roles y responsabilidades en la construcción del TDG

El autor del trabajo de grado asumió integración de **redacción académica**, **implementación** y **validación reproducible**. La empresa vinculada aportó contexto de negocio, priorización y validación informal de flujos. El director o tutor institucional guió el cumplimiento normativo APIT. Esta separación importa: las conclusiones técnicas deben poder defenderse aun cuando una opinión de *stakeholder* cambie post–entrega, porque la fuente primaria sigue siendo el repositorio versionado y los anexos firmados en la entrega.

### 5.9. Epistemología de la validación en proyectos híbridos academia–empresa

En proyectos que combinan rigor académico con ritmo de producto, la pregunta epistemológica es: **¿qué cuenta como “verdad” del sistema?** Tres capas interactúan. La primera es el **texto normativo** (FTG, RF/RNF). La segunda es el **código ejecutable** y sus pruebas. La tercera es la **opinión contextual** de usuarios o tutores. El TDG toma posición explícita: ante conflicto entre texto obsoleto y código actualizado sin anuncio, debe primar el **código con prueba** y corregir el texto; ante conflicto entre código y norma legal externa, priman **marco legal y ética**, exigiendo cambio de código o de alcance documentado.

Esta jerarquía evita dos extremos indeseables: el **formalismo** (creer que el PDF es la realidad) y el **criticismo técnico ciego** (creer que el commit lo justifica todo sin reflexión pedagógica o legal). El papel del estudiante es **mediar** entre capas, documentando excepciones y límites. Por eso el informe de pruebas (**Anexo 10**) insiste en honestidad de cobertura: sin ella, la segunda capa (código+prueba) pretende autoridad que no posee.

### 5.10. Lecciones sobre gestión del tiempo y alcance

Los proyectos de grado con alta ambición funcional sufren **cannibalización** del tiempo de redacción por culpa de incidentes de integración. Estrategias que funcionaron en este trabajo incluyen congelar hitos documentales al cerrar *releases* mayores, ejecutar `smoke:ci-local` antes de ceremonias de demostración y relegar refactors estéticos a backlog explícito. La consecuencia aceptada es deuda técnica conocida, preferible a prometer un sistema “perfecto” sin evidencias.

---

## 6. ANÁLISIS Y DISEÑO DEL SISTEMA

### 6.1. Actores y roles técnicos

| Actor | Rol `enum` | Responsabilidad macroscópica |
| --- | --- | --- |
| Administrador de plataforma | `ADMIN` | Multi–institución, escuelas, administradores, contexto transversal. |
| Personal administrativo | `ADMINISTRATIVO` | Nómina, finanzas, calendario, reportes, visitas, circuito operativo. |
| Docente | `DOCENTE` | Asistencia, actividades, notas, anotaciones, escáner, apoyo a circuito. |
| Padre o tutor | `PADRE` | Circuito familiar, consultas académicas de hijos, finanzas, comunicación. |
| Alumno | `ALUMNO` | Consultas autorizadas de horario, notas, boletines, credencial de acceso. |

El matiz de negocio para `ADMIN` —alcance multi–escuela cuando `school_id` es nulo en el modelo— se documenta en el **Anexo 01** y condiciona qué datos puede manipular un usuario frente a la API.

### 6.2. Síntesis de requerimientos funcionales

| Código | Descripción | Estado declarado |
| --- | --- | --- |
| RF1 | Autenticación con roles JWT | Cumplido |
| RF2 | Control de acceso QR/NFC | Cumplido |
| RF3 | Circuito de recogida con GPS | Cumplido (operador familiar) |
| RF4 | Gestión escolar | Ampliado |
| RF5 | Asistencia y calificaciones | Ampliado |
| RF6 | Pagos sin pasarela automática | Cumplido en alcance |
| RF7 | Avisos y notificaciones | Cumplido |
| RF8 | Panel y reportes | Ampliado |

**RF1 — Autenticación.** El sistema emite pares de *tokens* de acceso y renovación. La política de **un *refresh token* activo por usuario** simplifica revocación en el MVP. La recuperación de contraseña depende de SMTP; sin servidor de correo, el flujo queda degradado con mensajes en *log*. El **PrivacyGate** impone aceptación de política antes de operar la aplicación autenticada.

**RF2 — Acceso físico.** Se registran eventos de escaneo con método (`QR`, `NFC`, etc.). Reglas de negocio incluyen tolerancia de duplicados en ventana corta y unicidad de UID NFC activo por usuario. El personal autorizado usa `EscanerAccesoPage` bajo `/app/acceso/escaner`.

**RF3 — Circuito.** El padre o tutor crea solicitudes, actualiza avance y —cuando el flujo lo permite— ubicación. El personal atiende lista del día y transiciones institucionales. El dominio `departure-consent` vincula consentimientos de salida. Variantes de “solo consentimiento” se contemplan en la interfaz del detalle de circuito. La geolocalización apoya mapa y ETA; la confirmación final de entrega es acción explícita.

**RF4 — Gestión escolar.** Módulos `school` y `schools` cubren grupos, estudiantes, docentes, padres, importaciones Excel con `import_jobs`, configuración institucional y multiinstitución para `ADMIN`.

**RF5 — Académico.** Asistencia diaria y por clase, actividades con calificaciones por ítem, periodos académicos con estados (incluido periodo **CLOSED** que restringe cambios), boletines y documentos PDF/exportaciones según permisos.

**RF6 — Finanzas.** Conceptos, deudas, cargas de comprobantes con límites de tamaño, verificación y rechazo con trazas, políticas de cartera ejecutables como *jobs* donde está implementado. Archivos sensibles se entregan autenticados por `files`.

**RF7 — Comunicación.** Avisos, notificaciones en bandeja, registro opcional de *tokens* FCM, reportes administrativos con SLA y recordatorios cuando el entorno lo permite. El *shell* ofrece “Reportar problema” a roles distintos de `ADMIN`, generando registros en el dominio de notificaciones.

**RF8 — Panel y reportes.** *Dashboards* por rol con KPIs accionables en implementación reciente; reportes operativos y exportaciones Excel en rutas dedicadas (`reports`, `exports`).

### 6.2.1. Discusión ampliada por requerimiento (síntesis académica)

La lectura conjunta de **RF1** y **RF2** muestra una tensión habitual en campus: acelerar el ingreso sin sacrificar trazabilidad. La decisión de centralizar la emisión y verificación de credenciales en el mismo núcleo que conoce roles y escuela evita duplicar maestros de identidad; a la vez, obliga a un modelo de eventos de acceso lo suficientemente expresivo para auditoría posterior. En el producto, los *endpoints* de escaneo se amparan en servicios que validan vigencia, duplicados y contexto institucional; la interfaz de escáner privilegia claridad en estados de éxito y rechazo para reducir disputas en portería (**Anexo 09**).

**RF3** constituye el núcleo narrativo distintivo del caso de estudio: pocos sistemas escolares integran en un mismo *backoffice* la coordinación de salida con herramientas familiares móviles. La corrección de interpretación —el conductor del flujo en dispositivo familiar es el padre o tutor— evita atribuir al colegio obligaciones logísticas que el software no cubre. Desde diseño, ello implica permisos diferenciados, pantallas separadas para “hoy” en portería versus “mi circuito” en familia, y estados que las pruebas E2E recorren de punta a punta, incluyendo bloqueos cuando el circuito está deshabilitado o cuando persisten duplicados no permitidos (**Anexo 05**, **Anexo 10**).

**RF4** y **RF5** comparten la necesidad de un **calendario y periodización** coherente: las restricciones de periodo cerrado protegen integridad académica frente a cambios tardíos no autorizados. La ampliación documental respecto de la propuesta mínima incluye módulos de visitas, reuniones y anotaciones de atención, alineados con operación real de instituciones medianas. **RF6** se sostiene en la separación entre “carga de evidencia” y “reconocimiento institucional de pago”, coherente con el riesgo de fraude y con la preferencia por supervisión humana en el alcance declarado.

**RF7** y **RF8** cierran el ciclo comunicacional y analítico: la institución necesita no solo enviar avisos, sino constatar lecturas o acuses en comunicaciones críticas donde el dominio lo implementa, y disponer de paneles que condensen KPIs en lugar de exportaciones manuales permanentes. La coexistencia de notificaciones *in-app* y *push* opcional exige declarar dependencia de FCM; sin llaves de Firebase, el núcleo institucional sigue operativo con degradación controlada (**Anexo 07**, **technical-setup.md**).

### 6.3. Requerimientos no funcionales

| Código | Tema | Comentario |
| --- | --- | --- |
| RNF1 | Stack backend y PostgreSQL | Cumplido con TypeORM y migraciones. |
| RNF2 | Interfaz *responsive* | Cumplido con SPA y *shell* adaptable. |
| RNF3 | Seguridad | JWT, validación, throttling, archivos privados; HTTPS según despliegue. |
| RNF4 | Desempeño | **No** afirmar umbrales fijos sin medición; ver **Anexo 10**. |
| RNF5 | Usabilidad | Manual **09**; validación con usuarios piloto en **10** si aplica. |
| RNF6 | Infraestructura | Railway/cloud frente a *cPanel* histórico; razonable para Node+Postgres. |

### 6.3.1. Profundización de RNF3, RNF4 y RNF6 en el diseño

**RNF3 (seguridad)** no se reduce a “JWT habilitado”. En este proyecto incluye la composición de *guards*, la validación de pertenencia a institución en servicios, la exposición acotada de archivos mediante rutas dedicadas autenticadas, el *throttling* global y el escenario especializado de autenticación con límite estricto ejecutable aparte. También incluye decisiones de **hardening**: Helmet, CORS explícito, y separación entre documentación Swagger deshabilitada por defecto en producción. Una lectura crítica debe reconocer que la superficie XSS del SPA sigue siendo relevante mientras la sesión viva en almacenamiento del navegador; el texto no oculta ese compromiso.

**RNF4 (desempeño)** se abordó desde el **diseño** —consultas razonables, paginación implícita en muchos listados, uso de ORM con consciencia de índices documentados— pero el trabajo se niega a afirmar equivalencia entre diseño y resultado medido. Por ello el **Anexo 10** propone método, entorno y tamaño de datos como condición para cualquier tabla de latencias. En defensa académica, mostrar al menos un experimento breve con cronómetro o herramienta HTTP sobre *endpoints* de lectura frecuente cierra la brecha más obvia.

**RNF6 (infraestructura)** se materializa en compatibilidad con PostgreSQL administrado, variables típicas de PaaS (`DATABASE_URL`), volumen para archivos y pipeline CI reproducible. La decisión de no atar el núcleo a un proveedor específico en código —más allá de scripts y documentación— preserva **portabilidad relativa**, aunque cada nube imponga detalles de SSL o extensiones.

### 6.4. Arquitectura lógica

En `src/app.module.ts` los *bounded contexts* se registran en el orden de arranque del módulo raíz: **HealthModule**, **MailModule**, **AuthModule**, **AccessModule**, **CircuitModule**, **ClassAttendanceModule**, **ClassSessionsModule**, **NoticesModule**, **PaymentsModule**, **AttendanceModule**, **ActivitiesModule**, **AttentionNotesModule**, **AcademicPeriodsModule**, **ReportCardsModule**, **AcademicSchedulerModule**, **ReportsModule**, **SchoolModule**, **ExportsModule**, **DashboardModule**, **SchedulesModule**, **SchoolCalendarModule**, **SettingsModule**, **VehiclesModule**, **DocumentsModule**, **AuditModule**, **PrivacyModule**, **SchoolsModule**, **UploadsModule**, **FilesModule**, **DepartureConsentModule**, **EventSchedulerModule** y **ExternalVisitsModule**. El **DashboardModule** compone además subsistemas de tablero y **reuniones** (p. ej. **MeetingsModule** como dependencia del agregado de *dashboard*, y no como import directo en `AppModule`). La configuración transversal incluye `ConfigModule` con `validateEnv`, `TypeOrmModule.forRootAsync` usando `buildTypeOrmConfig()`, `ThrottlerModule` alimentado por `THROTTLE_TTL` y `THROTTLE_LIMIT`, **ScheduleModule** para tareas programadas y `ThrottlerGuard` publicado como `APP_GUARD`.

El *frontend* expone rutas públicas (`/`, `/login`, `/recuperar-contrasena`, `/restablecer-contrasena` en `frontend/src/App.tsx`) y el espacio autenticado bajo `/app` con `ProtectedRoute`, `PrivacyGate`, `AppShell` y `RoleGate` donde el riesgo de escalada lateral lo amerita. La navegación lateral se centraliza en `navConfig.ts` para coherencia con roles.

Vistas lógicas y de despliegue se ilustran en los diagramas fuente bajo `docs/imagenes/*.mmd` (exportar a PNG para la versión impresa; véase lista al final del documento).

### 6.5. Modelo de datos

Cuarenta y nueve entidades TypeORM mapean el dominio: usuarios y roles, estudiantes y eventos de *lifecycle*, padres y vínculos, personal administrativo, credenciales y eventos de acceso, circuito, asistencia y asistencia por clase, actividades y notas, boletines, calendario escolar, **reuniones** (entidades de encuentros y participantes bajo el subsistema gestionado vía **DashboardModule**), visitas externas y sus tablas puente, deudas y pagos, notificaciones y reportes administrativos, políticas de privacidad y aceptaciones, auditoría, trabajos de importación, entre otras. El arreglo literal se declara en `buildTypeOrmConfig()` dentro de `src/config/typeorm.config.ts`. El inventario tabla–archivo y el listado de despliegue se encuentran en el **Anexo 04** (secc. 8 y 9).

La política de persistencia combina **migraciones TypeORM** como referencia versionada y, en arranque, `ensureRuntimeSchema` como red idempotente —no sustituto de migraciones formales—, tal como razona el **Anexo 03** (secc. 12.1) y `docs/technical-setup.md`.

### 6.6. Diseño de interfaz y experiencia de usuario

Se priorizó **móvil** para familias en el circuito y operaciones críticas, y **escritorio** para administración intensiva. Principios: retroalimentación de errores comprensible, consistencia visual en *shell*, accesibilidad básica (contraste, foco, etiquetas en formularios críticos). El **Anexo 06** inventaria pantallas y rutas; el **Anexo 09** describe flujos por rol y mensajes frecuentes.

### 6.7. Diseño de contratos HTTP

Bajo `api/v1` (valor por defecto de `API_PREFIX` en configuración de ejemplo y CI) se exponen **241** operaciones HTTP contabilizadas en métodos `@Get`, `@Post`, `@Put`, `@Patch` y `@Delete` de los controladores en `src/modules/**/*.controller.ts`, cifra que coincide con el catálogo tabular del **Anexo 08** y que debe regenerarse con `npm run tdg:enrich` o contrastarse con `GET /docs` cuando el contrato evolucione. Swagger documenta esquemas y seguridad global *Bearer*; rutas públicas concretas deben interpretarse según implementación y prueba (login, *health*, recuperación de contraseña). Ante discrepancia textual, prevalece OpenAPI.

### 6.8. Casos de uso, secuencias y vistas UML

El **Anexo 05** concentra diagramas de casos de uso por actor, secuencias del circuito de recogida y vistas de contexto. En el cuerpo principal basta con resaltar que el **flujo feliz** del circuito articula tres perspectivas: creación y avance familiar, atención en portería o rol equivalente, y registros de auditoría o consentimientos cuando el dominio `departure-consent` aplica. Los diagramas de secuencia sirvieron para validar que ningún paso crítico quedara “solo en *frontend*”; cada transición institucional tiene contraparte persistida o mensaje de error explícito en API.

La traza UML también apoyó la enseñanza de ingeniería: separar actores **PADRE**, **ADMINISTRATIVO** y **DOCENTE** en casos de uso evitó amalgamar permisos incompatibles. Para el tribunal, las figuras exportadas desde `docs/imagenes/04-uml-casos-de-uso.mmd` y `05-uml-secuencia-circuito.mmd` deben acompañar el anexo gráfico numerado.

### 6.9. Trazabilidad y riesgos de deriva documental

La matriz del **Anexo 00** formaliza el vínculo bidireccional entre texto normativo y evidencias. Operativamente, el riesgo mayor es la **deriva**: el código avanza y el anexo no se actualiza. El proyecto mitigó esto con hábitos de *release* —actas y checklist— y con scripts de enriquecimiento, pero no hay sustituto a la revisión en *pull request*. Cuando el monorepo incluye cambios que afectan SQL, OpenAPI y UI a la vez, el costo de sincronizar tres superficies explica por qué el TDG declara la Swagger como “fuente viva” para contratos HTTP (**Anexo 08**).

### 6.10. Diseño para evolución, extensibilidad y costo del cambio

Un producto institucional raramente “termina” en el sentido académico del TDG: continúa en mantenimiento, nuevas normativas internas y demandas de informes. La arquitectura modular de NestJS permite **aislar** dominios de manera imperfecta pero útil: un cambio en `payments` no debería obligar a tocar `access` si los contratos públicos se respetan. La práctica observada en el repositorio fue combinar **módulos por contexto** con **servicios extensos** donde la complejidad acumulada sugiere refactor futuro (**Anexo 03**). El costo del cambio se concentra en **migraciones y datos existentes**: añadir columnas nullable o tablas nuevas es mecánica habitual; alterar invariantes de negocio (p. ej., unicidad histórica de un comprobante) exige planes de compatibilidad y comunicación con usuarios finales.

La decisión de mantener **OpenAPI** en el arranque —en lugar de un contrato estático únicamente— reduce fricción de desarrollo pero exige disciplina de seguridad: rutas administrativas sensibles no deben “colarse” sin esquema ni pruebas. La recomendación académica derivada es adoptar *review* de controladores con la misma seriedad que *review* de entidades, porque ambos impactan superficies de exposición.

### 6.11. Interoperabilidad, exportación e importación de datos

Escuela Pass incluye **importación Excel** y **exportaciones** (p. ej., rutas `exports` y exportaciones en dominio escolar) que actúan como puente hacia sistemas legados o hacia análisis en hojas de cálculo. Esta interoperabilidad pragmática reconoce que muchas instituciones no sustituirán de un día para otro todos sus procesos digitales. Desde diseño, la responsabilidad del software es **sanear** formatos, reportar errores comprensibles y persistir *jobs* de importación trazables (`import_jobs`), evitando operaciones silenciosamente perdidas.

La exportación de datos también tiene implicación de **privacidad**: un archivo descargado puede propagarse fuera del perimetro institucional. Por ello los permisos por rol y la segmentación por `school_id` no son detalles cosméticos sino controles de fuga de información. El manual de usuario (**Anexo 09**) debe enfatizar buenas prácticas de almacenamiento local en equipos personales cuando la guía institucional lo amerite.

### 6.12. Lectura de calidad ISO/IEC 25010 (síntesis aplicada)

Aunque el TDG no certifica ISO, la taxonomía de calidad del sistema es útil como **lente** de discusión. **Adecuación funcional** se sustenta en RF1–RF8 y la matriz de trazabilidad. **Fiabilidad** se apoya en transacciones de migración, pruebas E2E y políticas idempotentes de arranque, sin confundirlas con alta disponibilidad de centro de datos. **Seguridad** combina autenticación JWT, *throttling* y archivos privados, con deuda explícita en modelo de sesión del SPA. **Mantenibilidad** se ve favorecida por TypeScript y modularización, tensionada por servicios grandes en dominios críticos. **Portabilidad** es razonable gracias a contenedores lógicos (Postgres + Node) aunque existan scripts específicos de despliegue. **Rendimiento** (**RNF4**) y **satisfacción del usuario** (**RNF5**) quedan condicionados a evidencia posterior, coherente con la honestidad metodológica del **Anexo 10**.

### 6.13. Costo cognitivo de la documentación y retorno académico

Un paquete anexo extenso tiene **costo cognitivo** para autores y lectores. La decisión de segmentar inventarios (UML, API, ER) busca reducir el costo por tipo de consulta: un revisor de seguridad puede ir al **Anexo 03** y **08** sin recorrer prototipos; un revisor pedagógico puede ir al **Anexo 09**. El retorno académico es la **auditabilidad**: cada afirmación fuerte del cuerpo principal puede ligarse a una fila, diagrama o prueba. Sin esa segmentación, el texto central se inflaría hasta volverse inhomogéneo —mezcla de ensayo y manual— con peor calificación probable en claridad.

### 6.14. Arquitectura hexagonal y límites prácticos en NestJS

La **arquitectura hexagonal** sugiere aislar el núcleo de dominio de adaptadores de infraestructura. NestJS facilita inyección de dependencias y módulos, pero no impone automáticamente *ports & adapters* estrictos. En Escuela Pass, los **módulos por dominio** actúan como compromiso pragmático: aproximan límites claros para desarrollo incremental sin exigir la ceremonia completa de un *bounded context* ideal de Domain-Driven Design en cada historia de usuario.

Un lector avanzado podría criticar acoplamientos puntuales entre servicios y entidades expuestas en múltiples capas; la respuesta honesta es que el equilibrio costo–beneficio del grado privilegió **funcionalidad trazable** frente a pureza arquitectónica máxima. Las recomendaciones de refactor en el **Anexo 03** formalizan esa deuda para trabajo posterior.

Los **adaptadores** concretos incluyen TypeORM como adaptador de persistencia, Firebase Admin como adaptador de *push*, Nodemailer como adaptador SMTP y el cliente React como adaptador de presentación. Cambiar uno de ellos —p. ej., otro proveedor de correo— debería ser localizable si la lógica de negocio permanece en servicios; cuando no lo está, el costo del cambio aumenta.

---

## 7. IMPLEMENTACIÓN

### 7.1. Backend NestJS

El arranque (`src/main.ts`) crea directorios de *uploads*, puede migrar legados a volumen persistente, ejecuta migraciones pendientes en transacción, invoca `ensureRuntimeSchema`, sirve estáticos públicos bajo `/uploads` con política acotada (p. ej. logos escolares), aplica *helmet*, CORS con orígenes desde `CORS_ORIGIN`, `ValidationPipe` global y configura Swagger en `/docs` según entorno. El prefijo global API se toma de `API_PREFIX`.

Esa secuencia merece énfasis académico: **no servir tráfico** hasta concluir migraciones fallidas reduce estados medios peligrosos donde el código nuevo asume columnas que aún no existen. El saneo idempotente complementario no delega en el equipo la memoria de parches manuales dispersos, aunque tampoco reemplaza disciplina de migración —posición defendida en `technical-setup.md` y en el **Anexo 03**.

En ejecución establecida, cada solicitud HTTP atraviesa el **ValidationPipe** con *whitelist* y *forbidNonWhitelisted*, elevando el costo de *payloads* maliciosos o campos inesperados. Los controladores permanecen delgados en ideal, delegando reglas a servicios; la desviación de ese ideal en algunos módulos extensos es precisamente motivo de refactor futuro, pero no impidió cerrar RF en el estado evaluado.

Dominios críticos implementan *guards* por rol y validación de pertenencia institucional en servicios. Pagos y circuito concentran reglas de negocio extensas; el **Anexo 03** (secc. 12.6) sugiere refactors futuros sin romper contratos públicos.

### 7.2. Frontend React/Vite

La SPA consume la API con cliente HTTP centralizado, almacenamiento de *tokens* en `localStorage` y arranque opcional de FCM. Componentes de página viven en `frontend/src/pages/`, con módulos operativos reutilizados para comunicación y finanzas. Mapas dependen de `MAPBOX_ACCESS_TOKEN` y coordenadas institucionales cuando existen.

La separación de responsabilidades en cliente sigue el patrón **contenedor/página**: rutas definen *shell* y permisos; servicios de API encapsulan URLs bajo `VITE_API_BASE`; componentes presentacionales evitan lógica de negocio compleja. Esta disciplina es imperfecta —algunas páginas concentran validaciones que idealmente vivirían en utilidades compartidas— pero permite evolucionar pantallas sin reescribir el contrato backend.

El enrutador declara explícitamente rutas sensibles con `RoleGate`, reduciendo la probabilidad de que un usuario vea enlaces útiles pero no autorizados para ejecutar acciones; aun así, la seguridad real permanece en servidor. El cliente honesto asume **hostilidad** del entorno del navegador: cualquier checkeo UI puede sortearse con herramientas de desarrollador; por tanto, el TDG subraya defensa en profundidad en API.

### 7.3. Base de datos y migraciones

PostgreSQL recibe el esquema vía **Opción A** (DDL `escuela_pass_schema_v4.sql` con `npm run db:apply` en *greenfield*) u **Opción B** (cadena TypeORM exclusiva). Mezclar en un mismo entorno sin criterio provoca deriva documentada. Las pruebas E2E usan base separada preparada por `pretest:e2e` → `test/setup-e2e-db.js` y `.env.e2e`.

### 7.4. Despliegue e infraestructura

El manual técnico (**Anexo 07**) y `technical-setup.md` describen variables (`DATABASE_URL`/`POSTGRES_URL`, secretos JWT, `UPLOADS_DIR` en volumen, `THROTTLE_*`, FCM, SMTP, Mapbox). `railway.toml` y *runbooks* de releases sustentan despliegue en **Railway**; el *frontend* típicamente se publica en hosting estático con CORS alineado.

### 7.5. Seguridad operativa

- Hashing de contraseñas con bcrypt.  
- *Rate limiting* global y suite dedicada `auth-throttle-ip` con `AUTH_THROTTLE_LIMIT=5` para observar **429** en login inválido repetido.  
- Archivos privados servidos por `GET files/:bucket/:filename` autenticado.  
- Auditoría configurable mediante `audit_logs`.  

Limitación explícita: la estrategia de sesión en SPA incrementa la necesidad de higiene XSS y consideración de alternativas (*BFF*, cookies *httpOnly*, CSP) descritas en el **Anexo 03** (secc. 12.2).

### 7.6. Variables de entorno y configuración operativa

Más allá de los secretos JWT y la URL de PostgreSQL, el producto expone **palancas operativas** documentadas en `docs/technical-setup.md`: zona horaria IANA (`APP_TIMEZONE`) para cierres y políticas de cartera, topes opcionales para comprobantes (`VOUCHER_MAX_BYTES`), coordenadas y radio de llegada para mapas del circuito, *tokens* Mapbox, credenciales SMTP y configuración Firebase para FCM. La validación en arranque rechaza configuraciones incoherentes de base de datos (URL directa `postgres://` / `postgresql://` frente a bloque `DB_*`), reduciendo fallos tardíos en producción. En **Railway** u homólogos, la convención es proveer `DATABASE_URL` o `POSTGRES_URL` y volumen persistente para `UPLOADS_DIR`.

### 7.7. Tareas programadas y automatización interna

Los módulos **AcademicScheduler** y **EventScheduler** complementan flujos que no pueden depender exclusivamente de interacción humana: recordatorios, cierres o políticas ejecutadas en ventanas de tiempo configurables. Este enfoque se alinea con `@nestjs/schedule` ya habilitado en `AppModule`. La documentación técnica (**Anexo 07**) debe mantenerse sincronizada cuando nuevas tareas modifiquen datos financieros o académicos, pues constituyen superficies de riesgo si fallan silenciosamente.

### 7.8. Integraciones de terceros y degradación controlada

**FCM** permite *push* cuando existe cuenta de servicio válida; sin ella, las notificaciones permanecen en bandeja interna. **SMTP** habilita recuperación de contraseña y avisos por correo; sin `SMTP_HOST`, los envíos se omiten con *warning* en *log*, coherente con entornos de laboratorio. **Mapbox** mejora circuito y visualizaciones geográficas; sin *token*, la interfaz debe continuar usable con mensajes de configuración. Esta filosofía evita que el núcleo RF quede bloqueado por servicios externos, pero exige **comunicar honestamente** en manual de usuario qué capacidades están degradadas (**Anexo 09**).

### 7.9. Observabilidad mínima y respuesta a incidentes

En ausencia de una plataforma APM de pago en el alcance documentado, el producto provee **señales mínimas**: *logs* del servidor NestJS, registros de auditoría persistidos, *health check* HTTP y metadatos de error estructurados en respuestas válidas. Un operador puede correlacionar una queja de usuario con filas de `audit_logs` o con eventos de acceso si la institución habilitó esos dominios. Esta aproximación **no** sustituye trazas distribuidas ni métricas de saturation, pero es defendible para un MVP institucional y puede evolucionar hacia OpenTelemetry en trabajo futuro.

### 7.10. Cliente web: empaquetado, variables y entornos

El frontend en `frontend/` usa **Vite** y variables con prefijo `VITE_` (p. ej. base de API y *token* Mapbox según `docs/technical-setup.md`). El empaquetado de producción (`npm run build` en carpeta del cliente) produce *assets* estáticos aptos para CDN u hospedaje estático; la separación de despliegue respecto al API obliga a configurar **CORS** con orígenes explícitos. Esta separación es común en arquitecturas JAMstack/SPA y mejora la velocidad de despliegue del *frontend*, pero introduce el requisito de alinear versiones cliente–servidor cuando hay cambios *breaking* en contratos.

### 7.11. Consistencia eventual y tareas de negocio

Algunas operaciones —recordatorios, cierres automáticos de periodo según políticas o *jobs* financieros— pueden ejecutarse en **ventanas temporales** mediante `@nestjs/schedule`. El usuario percibe entonces un grado de consistencia eventual: lo que ve en pantalla puede desfasarse segundos o minutos respecto al resultado final del *job*. Documentar estas dinámicas en el manual reduce **falsos positivos de error** (“el sistema no actualiza”) cuando en realidad la actualización es diferida.

### 7.12. Recorrido por dominios implementados (lectura transversal)

Para el lector que proviene de la gestión escolar sin detalle de código, resulta útil un **recorrido verbal** de dominios tal como aparecen acoplados en producto. El dominio de **autenticación** concentra emisión de *tokens*, *refresh* único en MVP, recuperación de contraseña dependiente de SMTP y bloqueos por política de usuario inactivo. El dominio de **privacidad** antecede funcionalmente a la operación cotidiana vía `PrivacyGate`, registrando aceptantes contra versiones de política.

El dominio de **acceso físico** articula credenciales QR/NFC con eventos de escaneo; su valor está en la **regularidad** del registro y en la posibilidad de auditar excepciones. El de **circuito** relaciona solicitudes, estados, posible geolocalización y consentimientos de salida; es el más visible para familias y el más sensible a errores de sincronización, de ahí su protagonismo en pruebas. Los dominios **académicos** —asistencia diaria y por clase, sesiones, periodos, actividades y calificaciones, boletines— comparten la necesidad de cerrar ventanas temporales con integridad; un periodo **CLOSED** no es un detalle técnico sino una protección de acta.

La **comunicación institucional** mezcla avisos, bandeja, *push* opcional e informes administrativos con lógica de SLA según roles. La **cartera** modela conceptos, deudas, cargas y verificación de comprobantes con límites y tipos MIME razonables. Los dominios de **reporte y exportación** permiten a la institución extraer vistas operativas sin depender exclusivamente de consultas SQL manuales. El **calendario** y los **horarios** estabilizan la planificación; las **visitas externas** y las **reuniones** amplían el alcance administrativo más allá del aula diaria; las **anotaciones de atención** documentan seguimientos sensibles con permisos acotados.

Cada uno de estos dominios aporta filas al **catálogo HTTP**; juntos explican por qué la API alcanza orientativamente **241** operaciones. La lección de arquitectura es que “muchas rutas” no equivalen necesariamente a *bloat*: en sistemas administrativos reales, la granularidad refleja permisos finos y recursos distintos. La contrapartida es costo de mantenimiento, que el TDG honestamente reconoce.

### 7.13. Multi-institución lógica, contexto de escuela y superficie de autorización

La operación **multi–escuela** para el rol `ADMIN` de plataforma introduce una capa adicional de diseño: muchas consultas deben interpretarse con un **contexto de escuela** explícito o implícito derivado del usuario autenticado. Un error típico en sistemas mal gobernados es la **fuga horizontal** de datos entre clientes institucionales; Escuela Pass mitiga en servidor validando pertenencias y restringiendo conjuntos de resultados. El estudiante de posgrado o tribunal debe entender que esta mitigación **no** es una certificación formal de aislamiento multi–tenant: es una implementación documentada sujeta a revisiones futuras cuando se añadan *endpoints* o vistas que bypassen los servicios existentes.

El JWT transporta identidad y metadatos suficientes para enrutar autorización; la **complejidad** reside en mantener coherencia entre lo que el *frontend* muestra y lo que el *backend* acepta. Discrepancias generan frustración (“veo un alumno pero no puedo actuar”) y, peor, riesgos si el cliente construye URLs tentativas. Por ello el manual de usuario y las matrices HTTP/UI en anexos son parte del *contrato* de producto, no ornamento.

### 7.14. Compatibilidad de versiones cliente–servidor y política de cambios *breaking*

En despliegues desacoplados, el SPA puede quedar en CDN con caché agresiva mientras el API evoluciona horas después. Cuando un *breaking change* altera firmas de payload o códigos de error, la experiencia es falla parcial difícil de diagnosticar para usuarios no técnicos. Buenas prácticas incluyen versionar la API (`/v2`) en cambios mayores, o emitir compatibilidad temporal con *feature flags*. El trabajo documenta el prefijo `api/v1`; cualquier salto de versión mayor debería planearse con exportación OpenAPI archivada, *migration* coherente y ventana de convivencia. Esta subsección es recomendación de operación; el estado concreto del repositorio al cierre del TDG debe verificarse contra el tag Git correspondiente.

### 7.15. Almacenamiento de archivos, volúmenes y copias de seguridad

Los comprobantes de pago, avatares, logos y otros binarios viven bajo `UPLOADS_DIR` o rutas relativas documentadas. En producción, la **persistencia** entre despliegues exige volumen montado o almacenamiento objeto externo; de lo contrario, un redeploy podría silenciosamente borrar evidencias financieras localizadas en disco efímero. El manual técnico (**Anexo 07**) y `technical-setup.md` advierten este riesgo típico de PaaS.

Las **copias de seguridad** deben incluir tanto la base PostgreSQL como el almacén de archivos; restaurar solo una de las dos genera estados incoherentes (“comprobante referenciado pero archivo ausente”). Escuela Pass no sustituye política institucional de RPO/RTO; provee la separación lógica necesaria para que un administrador de sistemas diseñe *backups* coherentes. En términos académicos, esta subsección recuerda que el modelo ER y la API no agotan la ingeniería del sistema: **persistencia física** de archivos es parte del diseño operativo.

---

## 8. PRUEBAS, VALIDACIÓN Y RESULTADOS

### 8.1. Estrategia

La pirámide de pruebas del repositorio está **sesgada** hacia E2E: `npm run test:e2e` ejecuta archivos `*.e2e-spec.ts` con Jest y PostgreSQL real. Los *smokes* `npm run smoke:ci-local` encadenan *build* y E2E (`smoke:build` → `smoke:e2e`, según `package.json`). Las pruebas unitarias (`npm test`) existen pero con cobertura acotada; su función actual es más de **regresión local rápida** que de blindaje integral.

La elección de E2E como eje se justifica por tres factores del dominio. Primero, muchos fallos de Escuela Pass son **transaccionales**: una regla que pasa en memoria pero falla ante restricción de tabla o estado concurrente no se detecta en pruebas aisladas ingenuas. Segundo, varios flujos cruzan **múltiples módulos** —autenticación, permisos, persistencia, archivos— donde *mocks* mal calibrados crean falsos negativos o positivos. Tercero, el propio producto ya incluye tantas rutas HTTP que una estrategia exclusivamente manual repetida por release sería frágil ante el tiempo finito del trabajo de grado.

El contrapeso es el **costo**: suites E2E son más lentas y sensibles a datos semilla. El repositorio mitiga con scripts `pretest:e2e`, base `escuela_pass_test` y variables `.env.e2e`. Aun así, un cambio aparentemente pequeño en orden de *setup* puede romper múltiples tests; esto es señal de acoplamiento que podría reducirse con mejores *factories* de datos, línea futura mencionada en el **Anexo 10**.

Desde el ángulo académico, la estrategia debe leerse como **explícita**: no se afirma cobertura total del catálogo **241**, se afirma existencia de evidencia automatizada reproducible para un subconjunto representativo y de casos límite diseñados para seguridad y consistencia.

### 8.2. Suites relevantes

| Archivo | Propósito |
| --- | --- |
| `test/app.e2e-spec.ts` | Flujos amplios: salud, auth, asistencia, escaneo, clase, notas, circuito, reportes, exportaciones, configuración, *dashboard*, importaciones, visitas, reuniones, *lifecycle*. |
| `test/phase7-closure.e2e-spec.ts` | Casos de cierre: seguridad cruzada, duplicados de circuito, circuito deshabilitado, periodo cerrado, doble escaneo, comprobantes, JWT revocado, archivos privados, privacidad, asistencia vista familia. |
| `test/auth-throttle-ip.e2e-spec.ts` | *Throttle* IP estricto; bloque `describe` omitido salvo `npm run test:e2e:auth-throttle-ip`. |

### 8.3. Integración continua

El flujo **Backend CI** descrito en `.github/workflows/backend-ci.yml` (raíz del monorepo Git) valida `npm run build` y `npm run test:e2e` contra PostgreSQL 16 en contenedor, fijando variables de entorno de prueba. **No** incluye *build* del *frontend* en el estado actual del flujo, riesgo documentado en el **Anexo 10**.

### 8.4. RNF4 y RNF5

El cumplimiento de tiempos de respuesta “razonables” **exige** instrumentación: medir latencia de *endpoints* seleccionados o tiempos percibidos en UI, anotar entorno de red y tamaño de datos (**Anexo 10**, secc. 6). La usabilidad percibida se apoya en manual (**Anexo 09**) y puede completarse con encuesta piloto.

### 8.5. Evidencias esperadas en la entrega final

Capturas o *logs* de: corrida E2E exitosa, *build* backend, *build* opcional *frontend*, llamada a `GET /api/v1/health`, y figuras de Swagger con autenticación. Los detalles se tabulan en el **Anexo 10** (secc. 10 y 11).

### 8.6. Matriz de evidencia por requerimiento funcional

La siguiente tabla resume la trazabilidad entre RF y **tipos de evidencia** automatizada o manual, según el **Anexo 10**; el detalle de casos `it(...)` permanece en el código de prueba.

| Requerimiento | Evidencia de prueba (orientativa) |
| --- | --- |
| **RF1** | Inicio de sesión por rol, *refresh*, cierre de sesión, cuenta inactiva, *throttle* en suite dedicada (`npm run test:e2e:auth-throttle-ip`). |
| **RF2** | Escaneo QR/NFC, duplicados controlados, reglas de acceso y rechazos explícitos. |
| **RF3** | Creación de solicitud de circuito, bloqueo de duplicados, transiciones de estado, geolocalización donde aplica, confirmación explícita, circuito deshabilitado. |
| **RF4** | Nómina escolar, importaciones, eventos de *lifecycle* de estudiantes y docentes. |
| **RF5** | Asistencia, asistencia por clase, actividades y notas, boletines, periodo **CLOSED**. |
| **RF6** | Carga de comprobantes, verificación o rechazo, archivos privados con control de acceso. |
| **RF7** | Informes administrativos, SLA, recordatorios; FCM cuando el entorno provee credenciales. |
| **RF8** | Resumen en *dashboard*, KPIs accionables, reportes y exportaciones según rol. |

### 8.7. Pirámide de pruebas, deuda técnica reconocida y abuso de API

La estrategia priorizó **confianza en flujos críticos** mediante E2E con base real PostgreSQL, coherente con fallos que solo aparecen ante restricciones SQL y transacciones. La deuda manifiesta es **poca densidad de pruebas unitarias** en servicios extensos de dominio: el tiempo de corrida E2E y su fragilidad ante cambios de *fixtures* son el costo pagado. Una línea de mejora profesional consistente es extraer reglas puras a funciones probables unitariamente, manteniendo E2E como red de seguridad de integración.

En **abuso de API**, el repositorio documenta *throttling* global y un escenario focalizado en login; extender patrones similares a otros *endpoints* de alto riesgo (carga masiva, recuperación de contraseña) es decisión de ingeniería pendiente descrita en el **Anexo 10** (secc. 13.5).

### 8.8. Comandos reproducibles y contraste con CI

Para auditoría académica, la secuencia mínima defendible incluye: `npm ci`, `npm run build`, `npm run test:e2e` (que dispara `pretest:e2e` → `node ./test/setup-e2e-db.js` según `package.json`), y opcionalmente `npm run smoke:ci-local` como atajo de *build*+E2E. La paridad con la nube se obtiene comparando con el *job* `build-and-e2e` del flujo **Backend CI** (Ubuntu, Node 20, PostgreSQL 16, `.env` y `.env.e2e` generados en el propio YAML). La ausencia de `npm run build` del *frontend* en ese flujo debe citarse como limitación explícita en defensa oral.

### 8.9. Interpretación de resultados y transferencia al contexto institucional

Los **resultados automatizados** del repositorio deben interpretarse como evidencia de **consistencia interna** del software construido: si `npm run test:e2e` finaliza en verde contra PostgreSQL 16 con la configuración del workflow o local equivalente, hay una señal fuerte de que los flujos instrumentados en Jest se comportan según expectativas codificadas en `it(...)`. Eso **no** demuestra por sí solo aceptación institucional ni ausencia total de defectos latentes en rutas no cubiertas; tampoco sustituye pruebas de carga o seguridad especializada.

La **transferencia** al aula y a la administración real requiere pilotos con datos controlados, capacitación y políticas escritas. El software puede impedir ciertos errores (p. ej., ventana de duplicados de escaneo), pero no impide decisiones pedagógicas contradictorias fuera del sistema. Por ello el TDG separa **cumplimiento RF en sentido de ingeniería** de **adopción organizacional**, sin confundirlos.

En términos de **catálogo HTTP**, la existencia de **241** operaciones documentadas refleja la granularidad del producto actual: muchos *endpoints* sirven operaciones CRUD legítimas en dominios escolares complejos. Una lectura ingenua podría sugerir “cuanto más grande el número, mejor el sistema”; la lectura defendible es que el número refleja **superficie de integración** y, por tanto, demanda de mantenimiento, documentación y pruebas. Por eso el **Anexo 08** y la Swagger viva son activos tan importantes como el código.

Finalmente, la inclusión de **actas** y de un informe de pruebas con matriz RF↔evidencia permite que el tribunal siga un **rastro** desde una conclusión del cuerpo central hasta un artefacto verificable. Esa trazabilidad es el criterio de madurez académica más sólido frente a una demo puntual que podría montarse con datos *mock* sin persistencia real.

### 8.10. Modelo de amenazas simplificado (STRIDE) aplicado al diseño

Aunque no se ejecutó un proceso formal completo de modelado de amenazas en todas las historias, es posible esbozar una lectura **STRIDE** para demostrar alineación con buenas prácticas. En **Spoofing (suplantación)**, el sistema mitiga con autenticación JWT, revocación vía políticas de *refresh* y validación de identidad en rutas protegidas; la amenaza residual más discutida es robo de *tokens* desde el navegador frente a XSS. En **Tampering (manipulación)**, la integridad recae en validación de DTO, restricciones SQL en ORM y control transaccional en migraciones; los archivos privados requieren rutas que validen permisos antes de servir bytes.

En **Repudiation (repudio)**, la existencia de `audit_logs`, eventos de acceso y trazas de circuito aporta evidencia no repudiada a nivel aplicativo —nivel legal puede exigir sellado de tiempo externo, fuera de alcance. En **Information disclosure (divulgación)**, riesgos incluyen errores verbosos en desarrollo, Swagger expuesto indebidamente y exportaciones masivas; mitigaciones: deshabilitar Swagger en producción por defecto, permisos por rol y prácticas de datos sintéticos. En **Denial of service**, el *throttling* global y el escenario de login limitan abuso rutinario, aunque ataques volumétricos de red exigen protección perimetral. En **Elevation of privilege**, la superficie crítica son *guards* y chequeos de `school_id`; las pruebas `phase7-closure` buscan cruces indebidos.

Esta síntesis **no** sustituye un informe de seguridad profesional, pero orienta trabajo futuro y respuestas esperadas en evaluación oral.

### 8.11. Experimentos propuestos para cerrar RNF4 (plantilla metodológica)

Para dejar una **huella metodológica reusable**, se propone el siguiente esqueleto de experimento de latencia, a ejecutar en la versión final de defensa: **(1)** seleccionar tres *endpoints* de lectura frecuente y una operación de escritura relevante (p. ej., listado de estudiantes, consulta de deuda, registro de asistencia); **(2)** documentar máquina cliente, red (Ethernet/Wi-Fi), tamaño de base (filas orientativas en tablas centrales); **(3)** ejecutar N≥30 mediciones con herramienta HTTP o script repetible, descartando *outliers* de *cold start* si se declara; **(4)** reportar mediana y percentil 95; **(5)** comparar contra objetivo orientativo del **Anexo 10** sin convertirlo en SLA contractual.

Resultados negativos son igualmente valiosos si explican cuellos de botella (índices, *N+1* en ORM, tamaño de respuesta JSON). Ese tipo de honestidad refuerza la calidad académica del capítulo de pruebas más que una tabla bonita sin método.

---

## 9. EVOLUCIÓN DEL PRODUCTO Y OPERACIÓN

### 9.1. Actas de salida y prácticas de *release*

El repositorio y la carpeta `docs/releases/archive/` conservan actas que evidencian madurez incremental. La **acta de salida v1.3** (2026-04-26) aprueba el bloque de comunicación con SLA y acuse en comunicados críticos, finanzas operativas con políticas de cartera y KPI accionables en *dashboard*, y declara *Go* con suite E2E institucional en verde (declaración 25/25 en acta). La **acta de cierre de estabilización v1.3** (2026-04-26) cierra la fase de estabilización posterior con *gate* A10 cumplido y recomienda transición a mejora continua.

Estas evidencias no sustituyen el informe académico de pruebas (**Anexo 10**), pero demuestran prácticas de *release* y operación coordinadas con el producto descrito en el cuerpo principal. Desde la perspectiva del TDG, su valor es **doble**: por un lado, muestran que existió gobernanza con AlfaNetworks; por otro, fijan *baselines* de versión que el tribunal puede correlacionar con *tags* Git si el autor los conserva.

### 9.2. Consolidado operativo y *runbooks*

Fragmentos del consolidado operativo institucional (p. ej., guías de despliegue o checklists de Railway) aparecen citados en `docs/DOCUMENTACION_OPERATIVA_ESCUELA_PASS_CONSOLIDADO.md` y en el manual técnico. El cuerpo principal **no** reproduce esos textos íntegros para evitar duplicación; remite al lector a los anexos y al repositorio cuando una decisión operativa —volumen de almacenamiento, rotación de secretos, política de copias de seguridad— excede el alcance académico central pero es relevante para implantación.

### 9.3. Lecciones aprendidas transversales

Tres lecciones resaltan para proyectos similares. Primero, **negociar temprano** el significado exacto del circuito familiar reduce retrabajo de UI y de políticas. Segundo, **versionar el esquema** con la misma disciplina que el código evita incidentes en producción cuando el ORM y el SQL de referencia conviven en equipos mixtos. Tercero, **declarar integraciones opcionales** como tales protege la evaluación académica frente a la tentación de demostrar “todo conectado” sin credenciales reales, situación frecuente en ambientes educativos.

### 9.4. Continuidad posterior al trabajo de grado

Tras la entrega académica, la continuidad del producto depende de **(a)** acuerdos entre AlfaNetworks y clientes institucionales; **(b)** mantenimiento del repositorio con políticas de ramas y *code review*; **(c)** operación de bases y secretos conforme al manual técnico; **(d)** incorporación de mediciones RNF4/RNF5 para cerrar deudas declaradas en este texto. El autor puede conservar el rol de contribuidor o transferir conocimiento mediante documentación y *handover*; en ambos casos, el activo central sigue siendo la **trazabilidad**: sin ella, cualquier nueva funcionalidad erosiona la defensa del trabajo original.

### 9.5. Indicadores operativos sugeridos post–implantación

Más allá del TDG, una institución que adopte Escuela Pass debería monitorear **indicadores operativos** simples: tiempo medio de atención de solicitudes de circuito, tasa de comprobantes rechazados frente a aprobados, incidencias de acceso denegado con credencial válida, latencia percibida en horarios pico y disponibilidad del *health check*. Ninguno de estos indicadores aparece como panel obligatorio en el alcance académico cerrado, pero su existencia futura alimentaría la **mejora continua** mencionada en actas v1.3. El vínculo con RF8 es natural: un *dashboard* evolucionado puede hospedar estos KPIs cuando el negocio los defina con precisión.

---

## 10. CONCLUSIONES

Las conclusiones que siguen sintetizan el resultado del trabajo sin duplicar los inventarios del repositorio. Su lectura puede contrastarse punto a punto con la matriz del **Anexo 00** y con la evidencia E2E del **Anexo 10**.

En términos acumulativos, el proyecto demuestra que es posible **condensar** en un único producto varios procesos que, en papel o en hojas de cálculo dispersas, suelen generar opacidad y demoras. La hipótesis operativa del trabajo —unificar identidad digital, acceso físico, salida coordinada con familias, registro académico y flujos financieros revisados manualmente— encuentra materialización en módulos NestJS y en una SPA React que respeta roles sin duplicar maestros de datos innecesariamente. La **interpretación correctiva del RF3** evita atribuir al colegio responsabilidades logísticas que el software no cubre y, al mismo tiempo, reconoce el valor de la visibilidad móvil para quien conduce la solicitud desde su propio dispositivo.

La capa de **persistencia relacional** con cuarenta y nueve entidades explícitas en `buildTypeOrmConfig()` y cadena de migraciones ofrece una base para auditoría y reportes que sería difícil de sostener solo con almacenamiento documental NoSQL sin diseño adicional. Esta elección tiene costo: cada cambio de esquema atraviesa revisión, prueba y documentación en **Anexo 04**, pero ese costo es, precisamente, el precio de gobernanza en instituciones que deben justificar decisiones ante familias y órganos de control interno.

En el plano de la **verificación**, la dependencia de pruebas E2E y de la reproducibilidad en GitHub Actions fija un estándar mínimo objetivo para el autor y para lectores técnicos del tribunal. La limitación —*frontend* fuera del flujo CI— no invalida el *backend*, pero sí sugiere que el “producto completo” en sentido empresarial aún merece una **puerta de calidad** adicional en el cliente. Sobre **RNF4** y **RNF5**, el trabajo evita concluir más allá de la evidencia: diseñar para tiempos razonables y usabilidad es necesario pero no suficiente; las mediciones y pilotos propuestos en el **Anexo 10** son el camino prudente para cerrar esos puntos ante evaluación externa.

Finalmente, la **modularidad documentada** y los anexos especializados dejan abierta una trayectoria de mejora continua alineada con actas de salida recientes: comunicación con SLA, finanzas operativas y tableros analíticos son capacidades que muestran que el software trasciende el prototipo cuando la gobernanza de producto acompaña al código. El trabajo de grado, en esta versión escrita, se presenta como **síntesis y mapa** hacia esa evidencia extensa, no como sustituto de ella.

1. Escuela Pass **cumple** los requerimientos funcionales RF1–RF8 en los términos interpretados y documentados en el **Anexo 01**, incluida la precisión de negocio del **RF3** (operador familiar) y el **RF6** sin pasarela automática.  
2. Los **RNF** de *stack*, *responsive*, seguridad básica y despliegue cloud **se sustentan** en implementación y configuración documentada; **RNF4** y **RNF5** requieren **evidencia adicional** de medición y/o usuarios piloto para cerrarse ante tribunal sin ambigüedad.  
3. La **trazabilidad** centralizada en el **Anexo 00** permite auditar el vínculo entre texto de requerimientos y artefactos de código.  
4. El modelo de **49** entidades TypeORM y la cadena de migraciones constituyen una base relacional **gobernable**, sujeta a disciplina de cambio descrita en **Anexo 03** y `technical-setup.md`.  
5. Las **limitaciones residuales** —sesión en navegador, integraciones opcionales, pirámide de pruebas— son **conocidas y documentadas**, lo cual es condición necesaria para lectura honesta ante evaluadores académicos.  
6. La **documentación de API** viva en Swagger, junto al **Anexo 08**, reduce el riesgo de divergencia entre especificación y producto si se mantiene el *pipeline* de *release* documental.

---

## 11. RECOMENDACIONES

1. **Ejecutar y registrar** mediciones explícitas de desempeño (RNF4) en entorno declarado, anexando resultados al **Anexo 10** o al cuerpo principal según norma institucional.  
2. **Ampliar CI** para *build* y *lint* del *frontend*, reduciendo riesgo de regresión de empaquetado.  
3. **Fortalecer pruebas unitarias** en dominios críticos (*payments*, *circuit*, *auth*) complementando E2E.  
4. **Evaluar endurecimiento de sesión** (*BFF*, cookies *httpOnly*, CSP) como línea de investigación aplicada coherente con OWASP.  
5. **Mantener gobernanza esquema–migración–Anexo 04** ante cada cambio persistente.  
6. **Completar validación con usuarios reales** (RNF5) con instrumento reproducible.  
7. **Exportar OpenAPI** por versión de *release* y archivar junto al tag Git para auditoría institucional.  
8. **Plan piloto** con datos sintéticos en capturas de manual y TDG para minimizar exposición de menores.

Las recomendaciones anteriores **no** se presentan como una *checklist* de herramientas de moda, sino como extensiones coherentes con las limitaciones ya declaradas: sesión en navegador, pirámide de pruebas y dependencia de mediciones para **RNF4**. En trabajo futuro cercano, tres iniciativas maximizan retorno: **(i)** registrar números de desempeño con método explícito; **(ii)** integrar el *frontend* al mismo *pipeline* que protege el *backend*; **(iii)** archivar OpenAPI por versión para auditoría contractual. El resto —refactors de servicios extensos, *BFF*, CSP estricto— constituye deuda técnica gestionable una vez estabilizada la evidencia académica mínima de validación.

### 11.1. Priorización en tres horizontes (0–3 meses, 3–12 meses, investigación)

En el **horizonte inmediato**, priorizar mediciones mínimas de **RNF4** y capturas reproducibles de E2E/CI aporta la mayor reducción de riesgo académico con esfuerzo acotado. Incluir `npm run build` del cliente en un segundo *job* de GitHub Actions, aunque sea semanal, reduce sorpresas de empaquetado. En el **horizonte mediano**, la densidad de *unit tests* en dominios financieros y de circuito paga dividendos en velocidad de feedback y documentación viva de reglas. Finalmente, el **horizonte de investigación** —cookies *httpOnly*, *BFF*, CSP estricto— merece prototipo aparte para no bloquear entregas funcionales, pero debe mantenerse en el *backlog* explícito por tratarse de superficie de seguridad persistente.

---

## 12. REFERENCIAS

Las entradas siguientes cubren **marco legal colombiano** citado en el texto, **fundamentos REST** y **documentación técnica de producto** empleados efectivamente. Para el despliegue operational y comandos exactos, la fuente primaria sigue siendo el repositorio (`package.json`, `docs/technical-setup.md`, anexos 07 y 08). Completar con monografías o artículos de seguridad escolar y usabilidad que el autor haya consultado de manera efectiva en la versión impresa final, conforme APA 7.

AlfaNetworks. (s. f.). *Propuesta formal de trabajo de grado — Escuela Pass* [Documento interno de institución educativa y empresa].  

Congreso de Colombia. (2012, 17 de octubre). *Ley 1581 de 2012 — Régimen general de protección de datos personales*. Diario Oficial No. 48.483.  

NestJS. (s. f.). *Documentation — NestJS: A progressive Node.js framework*. https://docs.nestjs.com  

OpenJS Foundation. (s. f.). *Node.js documentation*. https://nodejs.org/docs  

OWASP Foundation. (s. f.). *OWASP Top Ten*. https://owasp.org/www-project-top-ten/  

PostgreSQL Global Development Group. (s. f.). *PostgreSQL Documentation*. https://www.postgresql.org/docs/  

React Team. (s. f.). *React — A JavaScript library for building user interfaces*. https://react.dev  

Fielding, R. T. (2000). *Architectural Styles and the Design of Network-based Software Architectures* [Tesis doctoral]. University of California, Irvine.  

Vite Team. (s. f.). *Vite — Next Generation Frontend Tooling*. https://vitejs.dev  

TypeORM. (s. f.). *TypeORM Documentation*. https://typeorm.io  

Mapbox. (s. f.). *Mapbox GL JS Documentation*. https://docs.mapbox.com  

Firebase. (s. f.). *Firebase Cloud Messaging — Admin SDK*. https://firebase.google.com/docs/cloud-messaging  

GitHub. (s. f.). *GitHub Actions Documentation*. https://docs.github.com/actions  

*(Completar con libros o artículos de seguridad escolar, gestión institucional o usabilidad usados efectivamente en el marco teórico ampliado de la versión final impresa.)*

---

## 13. LISTA DE FIGURAS Y TABLAS PROPUESTAS

Las fuentes diagramáticas actuales del repositorio son archivos **Mermaid** (`.mmd`) bajo `docs/imagenes/`. Para la versión en Word del TDG se recomienda **exportar cada uno a PNG** (mismo nombre base, extensión `.png`, p. ej. `docs/imagenes/01-arquitectura-contexto-lr.png`) o regenerar desde el editor institucional. Si el PNG aún no existe en el árbol del proyecto, insertar resultado de exportación en la entrega final.

| ID | Descripción sugerida | Fuente en repositorio / archivo PNG |
| --- | --- | --- |
| Figura 1 | Vista de contexto lógico — módulos y actores | `01-arquitectura-contexto-lr.mmd` → `docs/imagenes/01-arquitectura-contexto-lr.png` *(insertar si no está en disco)* |
| Figura 2 | Diagrama de despliegue típico (Railway, volumen, SPA) | `02-arquitectura-despliegue-td.mmd` → `docs/imagenes/02-arquitectura-despliegue-td.png` |
| Figura 3 | Modelo entidad–relación (núcleo) | `03-modelo-er-nucleo.mmd` → `docs/imagenes/03-modelo-er-nucleo.png` |
| Figura 4 | Casos de uso por roles y RF | `04-uml-casos-de-uso.mmd` → `docs/imagenes/04-uml-casos-de-uso.png` |
| Figura 5 | Secuencia del circuito de recogida (RF3) | `05-uml-secuencia-circuito.mmd` → `docs/imagenes/05-uml-secuencia-circuito.png` |
| Figura 6 | Cronograma / Gantt del proyecto | `06-cronograma-gantt.mmd` → `docs/imagenes/06-cronograma-gantt.png` |
| Figura 7 | Captura — Swagger `/docs` con autenticación | Captura desde entorno de prueba (no versionada en repo) |
| Figura 8 | Captura — *Dashboard* o panel por rol | Captura desde entorno de prueba |
| Figura 9 | Captura — resultado `npm run test:e2e` o GitHub Actions | Evidencia gráfica vinculada al **Anexo 10** |

| Tabla | Contenido |
| --- | --- |
| Tabla 1 | Actores y roles (secc. 6.1) |
| Tabla 2 | Síntesis RF (secc. 6.2) |
| Tabla 3 | Síntesis RNF (secc. 6.3) |
| Tabla 4 | Suites E2E (secc. 8.2) |
| Tabla 5 | Matriz RF ↔ evidencia de prueba (secc. 8.6) |

---

## 14. ÍNDICE DE ANEXOS

| Anexo | Título breve | Archivo en `docs/tdg/redaccion-activa/` | Secciones de referencia frecuente |
| --- | --- | --- | --- |
| 00 | Matriz de trazabilidad | `00-matriz-trazabilidad.md` | Secc. 2 matriz RF/RNF; 2.1 alcance ampliado; 4 inconsistencias; 5 flujos |
| 01 | Documento de requerimientos | `01-requerimientos.md` | Secc. 3 RF; 4 RNF; 5 aceptación; 5.1 HTTP/UI; 7 reglas |
| 02 | Actas de reuniones AlfaNetworks | `02-actas-reuniones.md` | Actas y relación con anexos |
| 03 | Documento de arquitectura | `03-arquitectura.md` | Secc. 2 vista lógica; 4 seguridad; 12 limitaciones |
| 04 | Modelo entidad–relación | `04-modelo-er.md` | Secc. 8 inventario; 9 despliegue |
| 05 | Diagramas UML | `05-diagramas-uml.md` | Casos de uso y secuencia; secc. 8 (E2E) |
| 06 | Prototipos UI/UX | `06-prototipos-ui-ux.md` | Secc. 3 inventario; 9–10 rutas |
| 07 | Manual técnico | `07-manual-tecnico.md` | Instalación; CI/CD; secc. 13 mejoras |
| 08 | Documentación API | `08-documentacion-api.md` | Secc. 3 dominios; 7 por RF; 10 catálogo **241** rutas; 12 mejoras |
| 09 | Manual de usuario | `09-manual-usuario.md` | Secc. 4–8 perfiles; 15 rutas; 16 mejoras |
| 10 | Informe de pruebas y métricas | `10-informe-pruebas-metricas.md` | Secc. 4 estrategia; 8 E2E; 9 matriz RF; 13 mejoras |

---

*Fin del texto principal propuesto para el documento final — TDG Escuela Pass 2026.*
