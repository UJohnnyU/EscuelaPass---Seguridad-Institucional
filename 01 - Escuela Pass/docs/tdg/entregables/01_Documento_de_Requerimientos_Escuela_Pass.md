# 01. Documento De Requerimientos Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Especificación funcional y no funcional  
**Versión:** 1.0 documental  


Fuentes normativas usadas para estos entregables:
- Manual de estilo APIT: Times New Roman 12 pt, márgenes de 2.54 cm, espaciado sencillo,
  títulos numerados, citación autor-fecha y referencias APA 7.
- Plantilla TDG: portada, contraportada, resumen, introducción, capítulos por objetivo,
  conclusiones, recomendaciones, referencias y anexos.
- Propuesta FTG aprobada: RF1-RF8, RNF1-RNF6, objetivos, alcance y entregables.

Nota de originalidad: la redacción fue reconstruida en estilo académico propio a partir de
la propuesta, el código fuente y la documentación técnica del repositorio. El trabajo externo
de referencia solo se usó para observar estructura documental y nivel de detalle.


## 1. Introducción


Escuela Pass es una aplicación web institucional de AlfaNetworks orientada a la administración
y seguridad escolar. La solución combina una API NestJS con PostgreSQL, una SPA React/Vite,
control de acceso por QR/NFC, circuito de recogida iniciado por padres o tutores, comunicación
por avisos y notificaciones, gestión académica, pagos, reportes y despliegue cloud.

La interpretación oficial del RF3 es que los padres o tutores actúan como conductores del
circuito de recogida desde la aplicación web móvil; no se trata de una flota independiente de
vehículos escolares administrada por terceros. La geolocalización se usa como apoyo informativo
para el mapa y ETA, mientras las transiciones de estado relevantes son acciones explícitas.


## 2. Actores Del Sistema

| Actor | Rol técnico | Responsabilidades principales |
| --- | --- | --- |
| Administrador de plataforma | ADMIN | Configuración transversal, gestión de escuelas, usuarios administrativos y auditoría. |
| Personal administrativo | ADMINISTRATIVO | Gestión escolar, pagos, calendario, reportes, visitas y operación institucional. |
| Docente | DOCENTE | Registro de asistencia, actividades, calificaciones, anotaciones, horarios y apoyo al circuito. |
| Padre o tutor | PADRE | Circuito de recogida, consulta académica de hijos, pagos, reuniones, visitas y notificaciones. |
| Alumno | ALUMNO | Consulta de horario, boletines, actividades y credenciales de acceso cuando aplica. |

## 3. Requerimientos Funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RF1 | Autenticación con roles JWT | Cumplido |
| RF2 | Control de accesos QR/NFC | Cumplido |
| RF3 | Circuito de recogida con GPS | Cumplido con ajuste: conductor = padre/tutor |
| RF4 | Gestión escolar | Ampliado |
| RF5 | Asistencia y calificaciones | Ampliado |
| RF6 | Pagos y colegiaturas | Cumplido sin pasarela automática |
| RF7 | Avisos y notificaciones | Cumplido |
| RF8 | Dashboard administrativo | Ampliado |

### 3.1 Reglas Transversales

- Todo flujo protegido requiere autenticación JWT, salvo login, refresh, logout, recuperación de contraseña y salud pública.
- Los permisos se definen por rol; `ADMIN` tiene alcance global y los demás roles se restringen por escuela, grupo, hijo o asignación docente.
- La información académica y financiera se consulta según pertenencia institucional y relaciones padre-estudiante.
- Las operaciones de archivo se limitan a tipos y tamaños permitidos; los uploads se almacenan en volumen persistente o carpeta local.

## 4. Requerimientos No Funcionales

| Código | Descripción | Estado |
| --- | --- | --- |
| RNF1 | NestJS y PostgreSQL | Cumplido |
| RNF2 | Diseño responsive | Cumplido |
| RNF3 | Seguridad: bcrypt, JWT, validación, SQL seguro | Cumplido; HTTPS depende del despliegue |
| RNF4 | Operaciones principales menores a 2 s | A validar con métricas |
| RNF5 | Interfaz intuitiva | A validar con usuarios |
| RNF6 | Hosting proporcionado | Ajustado frente a cPanel propuesto |

## 5. Criterios De Aceptación Por Requerimiento

| Código | Criterio de aceptación |
| --- | --- |
| RF1 | Un usuario válido inicia sesión, recibe tokens, accede a `/auth/me` y no puede entrar a rutas fuera de su rol. |
| RF2 | Un escaneo QR/NFC válido registra entrada o salida y deja traza; credenciales inválidas son rechazadas. |
| RF3 | Un padre crea solicitud, actualiza avance/GPS, el personal la visualiza y se confirma/cancela según estado. |
| RF4 | Administración crea y actualiza grupos, materias, estudiantes, docentes, padres y asignaciones. |
| RF5 | Docente o administración registra asistencia y calificaciones; padre/alumno consultan información autorizada. |
| RF6 | Administración crea deudas; padre sube comprobante; administración verifica o rechaza. |
| RF7 | Aviso creado genera bandeja y, si hay token FCM, push web. |
| RF8 | Dashboard y reportes entregan indicadores operativos y exportables. |

## 6. Fuera De Alcance Del MVP

- Aplicaciones móviles nativas Android/iOS.
- Pasarela de pagos automática.
- Reconocimiento facial.
- Soporte multiidioma.
- Analítica avanzada con inteligencia artificial.
