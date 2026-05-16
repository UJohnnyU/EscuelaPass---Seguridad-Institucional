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

## ACTA ÚNICA CONSOLIDADA DE REUNIONES — PROYECTO ESCUELA PASS

### 1. Objeto

Dejar constancia formal y firmada de los acuerdos alcanzados entre el **Politécnico Colombiano Jaime Isaza Cadavid** —representado por el autor del trabajo de grado— y **AlfaNetworks** —empresa promotora del producto—, durante el ciclo de definición, diseño, implementación, validación y cierre del sistema **Escuela Pass**. La presente acta unifica en un solo documento institucional los hechos y compromisos de las sesiones de trabajo realizadas durante el proyecto, desde su levantamiento de necesidades hasta su preparación de entrega académica.

El marco normativo y técnico de referencia para los acuerdos abarca la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares** (LFPDPPP) (Cámara de Diputados, 2010), las guías del **Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales** (INAI, s. f.), la práctica recomendada de la IEEE Std 830-1998 sobre especificación de requerimientos (IEEE, 1998), el modelo de calidad ISO/IEC 25010:2011 (ISO, 2011) y el marco de gestión iterativa Scrum (Schwaber & Sutherland, 2020). Las siglas API (Application Programming Interface), REST (Representational State Transfer), JWT (JSON Web Token), QR (Quick Response), NFC (Near Field Communication), GPS (Global Positioning System), FCM (Firebase Cloud Messaging) y SMTP (Simple Mail Transfer Protocol) se interpretan en el sentido del glosario consolidado del cuerpo principal del trabajo de grado.

### 2. Antecedentes

El proyecto **Escuela Pass** se desarrolla como trabajo de grado en el marco del programa de **Ingeniería Informática** del **Área de Programas Informáticos y Telecomunicaciones (APIT)**, con base en una **Ficha de Trabajo de Grado (FTG)** previamente aprobada que establece la pregunta de investigación, el objetivo general, los cinco objetivos específicos y los requerimientos funcionales y no funcionales del sistema. La empresa **AlfaNetworks** actúa como contraparte funcional del producto y aporta lineamientos de negocio, contexto institucional sobre el sector de escuelas privadas en México y validación práctica del alcance entregable.

### 3. Asistentes

| Rol | Identidad |
| --- | --- |
| Autor del trabajo de grado (Politécnico Colombiano Jaime Isaza Cadavid) | **Jhon Kevin Murillo Martínez** — Ingeniería Informática, APIT |
| Representante de **AlfaNetworks** | _____________________________________________ (nombre completo y cargo) |
| Asesor académico del trabajo de grado (cuando corresponde) | **Alirio Antonio Gutiérrez Quintero** |

### 4. Agenda consolidada

La presente acta unifica las temáticas tratadas durante el ciclo de proyecto:

1. Levantamiento de necesidades institucionales y definición de roles del producto.
2. Acuerdo sobre los requerimientos funcionales y no funcionales del sistema.
3. Decisiones arquitectónicas y tecnológicas del producto.
4. Estrategia de validación y de pruebas automatizadas reproducibles.
5. Cierre académico, organización de entregables y firma del paquete documental.

### 5. Acuerdos por temática

#### 5.1. Alcance, actores y necesidades institucionales

Las partes acuerdan que **Escuela Pass** se desarrolla como aplicación web responsiva, dirigida a instituciones educativas privadas de México, sin aplicaciones móviles nativas en el alcance del proyecto académico. Se priorizan cuatro pilares: seguridad escolar, administración académica, comunicación institucional y control de accesos al plantel. Se definen cinco roles de uso: administrador de plataforma con alcance multi‑institución, personal administrativo de cada escuela, docente con vínculos de asignatura y grupo, padre o tutor responsable, y alumno con consultas autorizadas. El tratamiento de datos personales de menores y de la comunidad escolar se aborda con flujos de privacidad versionada y registros de aceptación, sin que ello sustituya las responsabilidades jurídicas que recaen en la institución cliente conforme a la legislación mexicana aplicable.

#### 5.2. Requerimientos funcionales y no funcionales

Las partes ratifican el conjunto de requerimientos funcionales y no funcionales aprobados en la propuesta formal y, sobre esa base, acuerdan precisiones operativas relevantes para el producto: el **circuito de recogida** se implementa como flujo iniciado y operado por padres o tutores desde la aplicación, sin flota institucional independiente; la **gestión de pagos** se cierra mediante deuda, carga de comprobante por la familia y verificación humana del comprobante por personal autorizado, sin pasarela bancaria automática en el alcance del proyecto; las **notificaciones** combinan bandeja interna en la aplicación y, opcionalmente, notificaciones a navegadores cuando el despliegue lo configura; el **control de acceso** combina credenciales QR y NFC con reglas explícitas para el manejo de lecturas duplicadas en ventana breve; los **flujos de identidad** incluyen recuperación y restablecimiento de contraseña cuando el entorno de correo está disponible.

#### 5.3. Decisiones arquitectónicas y tecnológicas

Las partes acuerdan la pila tecnológica y el esquema de despliegue del producto: el servicio web se construye con **NestJS** y **TypeScript** sobre **PostgreSQL**, gestionada mediante un mapeador objeto‑relacional con migraciones versionadas; el cliente web se construye con **React**, **Vite** y utilidades de estilo responsivo. El despliegue del servicio y de la base de datos es compatible con plataformas como servicio modernas; el alojamiento del cliente puede realizarse en proveedores estáticos. Para mapas y estimaciones del circuito se adopta un proveedor lado cliente con **degradación elegante** cuando faltan credenciales y cálculo geodésico Haversine como apoyo. La seguridad de la interfaz HTTP incluye limitación global de tasa de peticiones, conjunto acotado de rutas públicas y verificación de tokens portadores con vencimiento configurable. Estas decisiones, en cuanto refinan medios técnicos no detallados punto por punto en la propuesta inicial, se justifican en el cuerpo del trabajo de grado y en el anexo de arquitectura siguiendo la tríada motivación, problema concreto resuelto y beneficio observado, sin alterar la pregunta de investigación ni los cinco objetivos específicos aprobados.

#### 5.4. Validación, pruebas y reproducibilidad

Las partes acuerdan que la documentación interactiva en formato **OpenAPI** generada por el servicio se utiliza como referencia viva de contratos en entornos no productivos. La estrategia de validación se centra en pruebas extremo a extremo del servicio contra una base de datos real, con pruebas de humo combinadas e integración continua reproducible sobre la infraestructura del repositorio. Las mediciones de desempeño y la evaluación de usabilidad con usuarios piloto quedan formalmente planificadas, no ejecutadas como estudios estadísticos en el horizonte académico, lo que se reconoce con honestidad metodológica en el documento.

#### 5.5. Cierre académico, organización de entregables y firma

Las partes acuerdan que la organización del texto desarrollado y de los anexos del trabajo de grado atenderá las directrices de extensión, citación, estilo, originalidad y formato del programa académico. Las figuras y capturas que acrediten acuerdos técnicos se fundan en evidencia reproducible desde el producto y el repositorio. Las diferencias entre el texto original de la propuesta y el producto efectivamente entregado se documentan como evoluciones justificadas en el cuerpo del trabajo y en el anexo de arquitectura, conforme al criterio del asesor.

### 6. Compromisos

Como compromisos formales derivados de los acuerdos precedentes:

- **El autor del trabajo de grado** se compromete a entregar el producto, su documentación académica y el paquete de anexos conforme al alcance acordado, manteniendo el repositorio como fuente única de verdad técnica para evaluación académica.
- **AlfaNetworks** se compromete a acompañar el cierre académico del proyecto y a facilitar, dentro del alcance del trabajo de grado, los lineamientos de negocio y la retroalimentación operativa requerida para refinar la documentación.
- **El asesor académico**, cuando corresponda, acompaña la coherencia entre la propuesta aprobada, la ejecución y el documento final, sin asumir compromisos jurídicos por parte de la empresa o de la institución cliente.

### 7. Observaciones

El presente documento concentra el contenido formal de las sesiones realizadas durante el ciclo del proyecto y reemplaza, para efectos de constancia ante el programa académico, cualquier acta parcial previa. Los datos administrativos de fecha y lugar de suscripción se completan al momento de la firma; cualquier modificación posterior a esos datos se entiende como corrección administrativa que no altera el contenido sustantivo de los acuerdos.

### 8. Constancia de conformidad y firma

Las partes manifiestan estar conformes con el contenido íntegro de la presente acta consolidada, una vez completados los datos de **fecha** y **lugar o modalidad** indicados al pie. Suscriben en señal de aceptación.

**Lugar y fecha de suscripción:** ____________________________________________________________

**Modalidad de la suscripción (presencial o remota):** _________________________________________

| Rol | Nombre completo | Firma |
| --- | --- | --- |
| Autor del trabajo de grado | **Jhon Kevin Murillo Martínez** | ____________________________________ |
| Representante de AlfaNetworks | _________________________________________ | ____________________________________ |
| Asesor académico (firma opcional) | **Alirio Antonio Gutiérrez Quintero** | ____________________________________ |

---

*Fin del Anexo 02 — Acta única consolidada de reuniones del proyecto Escuela Pass.*
