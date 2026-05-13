# 10. Informe De Pruebas Y Métricas Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Validación funcional y operativa  
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


## 1. Objetivo

Validar que Escuela Pass cumple los requerimientos funcionales, no funcionales y de seguridad
definidos en la propuesta y en la matriz de trazabilidad.

## 2. Estrategia De Pruebas

| Tipo | Evidencia | Propósito |
| --- | --- | --- |
| Build backend | npm run build / smoke:build | Compila NestJS |
| E2E backend | npm run test:e2e / smoke:e2e | Valida flujos principales con Postgres |
| CI | .github/workflows/backend-ci.yml | Build + e2e en PR/push a main |
| Frontend build | npm run build en frontend | Recomendado para release; no está en CI actual |
| Pruebas manuales | Swagger + UI | Login, acceso, circuito, pagos, asistencia, boletines |
| Métricas | Dashboard/reports/observación | Tiempo de respuesta, éxito de operación, satisfacción |

## 3. Casos Críticos

| Caso | Resultado esperado |
| --- | --- |
| Login por rol | Token válido, redirección y menú según rol. |
| Escaneo QR/NFC | Registro de acceso o rechazo con mensaje controlado. |
| Circuito padre | Solicitud creada, notificación, mapa/avance y confirmación. |
| Asistencia | Registro por docente/admin y consulta por padre. |
| Calificaciones | Actividad con notas, boletín y PDF/exportación. |
| Pago | Deuda creada, comprobante subido, verificación o rechazo. |
| Aviso | Bandeja y push FCM si el dispositivo está registrado. |

## 4. Métricas Propuestas

- Tiempo de respuesta menor a 2 segundos en operaciones comunes.
- Porcentaje de flujos críticos exitosos en prueba funcional.
- Número de incidencias por rol durante prueba piloto.
- Satisfacción percibida de usuarios piloto.
- Disponibilidad de API medida por `GET /health`.

## 5. Riesgos Detectados

- CI actual no ejecuta frontend build/lint.
- La suite unitaria es limitada; el valor principal actual está en E2E y smoke.
- Las métricas de satisfacción requieren usuarios piloto reales o encuesta institucional.
