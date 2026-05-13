# 08. Documentación API Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Resumen académico de endpoints REST  
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


## 1. Criterio De Documentación

Swagger en `/docs` es la especificación viva. Este documento resume la API para el trabajo de
grado, agrupando endpoints por dominio y describiendo responsabilidad, roles y propósito.

## 2. Endpoints Por Dominio

| Dominio | Base path | Operaciones principales |
| --- | --- | --- |
| Auth | /auth | login, me, refresh, logout, forgot/reset password |
| Access | /access-events | credencial QR/NFC, escaneo y asignación |
| Circuit | /circuit-requests | solicitudes, GPS, avance, estados, mapa, confirmación |
| School | /school | grupos, materias, alumnos, docentes, padres, importaciones |
| Schools | /schools | multiinstitución, admins escolares |
| Attendance | /attendance | registro individual/bulk, consulta grupo/padre, excusas |
| Activities | /activities | actividades, tablero, cierre, reapertura, calificaciones |
| Academic | /academic-periods, /report-cards, /documents | periodos, boletines, PDFs |
| Payments | /payments | conceptos, deudas, comprobantes, verificación, arreglos |
| Notices | /notices, /notifications | avisos, bandeja, FCM, reportes administrativos |
| Schedule | /schedules, /class-sessions, /calendar | horarios, sesiones, días no lectivos |
| Reports | /reports, /exports, /dashboard | KPIs, Excel, reportes operativos |
| Agenda | /external-visits, /meetings | visitas, reuniones, RSVP y recordatorios |
| Support | /uploads, /audit, /privacy, /settings, /health | archivos, auditoría, privacidad, configuración, salud |

## 3. Seguridad API

- Bearer JWT para rutas protegidas.
- Roles por endpoint con `@Roles` y `RolesGuard`.
- `ADMIN` tiene bypass global; otros roles se restringen por relación institucional.
- Validación DTO por `ValidationPipe`.
- Rate limit global por `ThrottlerGuard`.

## 4. Formatos De Respuesta

La API responde principalmente JSON. Exportaciones y documentos usan:
- Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- PDF: `application/pdf`.
- Uploads: rutas públicas `/uploads/...` en entorno de desarrollo o volumen.

## 5. Recomendación De Anexo

Para anexos extensos, exportar Swagger/OpenAPI o capturas de `/docs`; no incluir todos los DTOs
en el cuerpo principal para evitar exceder el límite académico.
