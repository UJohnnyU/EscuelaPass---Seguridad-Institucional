# 07. Manual Técnico Escuela Pass

**Proyecto:** Escuela Pass — Administración y Seguridad Escolar  
**Autor:** Jhon Kevin Murillo Martínez  
**Programa:** Ingeniería Informática — Área de Programas Informáticos y Telecomunicaciones  
**Tipo de documento:** Instalación, configuración y mantenimiento  
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


## 1. Requisitos

- Node.js 20 o superior.
- PostgreSQL 13+; CI usa PostgreSQL 16.
- Variables `.env` para JWT, BD, CORS y servicios opcionales.
- Cuenta Firebase si se habilita push.
- Token Mapbox si se requiere ETA/rutas.

## 2. Instalación Backend

```bash
npm install
cp .env.example .env
npm run start:dev
```

Swagger queda disponible en `http://localhost:3000/docs` y health en
`http://localhost:3000/api/v1/health`.

## 3. Base De Datos

Opción A: SQL v4 para desarrollo greenfield.  
Opción B: migraciones TypeORM desde una base vacía o ya versionada.

En producción el arranque ejecuta migraciones pendientes antes de exponer el servidor. El helper
`ensureRuntimeSchema` actúa como red idempotente, no como sustituto de migraciones.

## 4. Instalación Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Variables principales: `VITE_API_BASE`, `VITE_MAPBOX_ACCESS_TOKEN`, `VITE_FIREBASE_*` y
`VITE_FIREBASE_VAPID_KEY`.

## 5. Despliegue

- API: Railway con `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` y volumen `/data` con `UPLOADS_DIR=/data`.
- Frontend: Vercel u hosting estático con build Vite.
- CI: workflow backend con build y E2E contra Postgres.

## 6. Mantenimiento

- Ejecutar smoke tests antes de release.
- Revisar logs de migraciones y `ensureRuntimeSchema`.
- Respaldar PostgreSQL antes de cambios de esquema.
- Revisar tokens FCM, SMTP y permisos del volumen de uploads.
- Actualizar documentación cuando cambien rutas o módulos.

## 7. Variables Críticas

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | Conexión principal PostgreSQL. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firma de tokens de acceso y refresh. |
| `CORS_ORIGIN` | Orígenes permitidos para frontend. |
| `UPLOADS_DIR` | Carpeta persistente para comprobantes, avatares, evidencias y logos. |
| `FRONTEND_URL` | Enlaces de correo y navegación desde notificaciones. |
| `MAPBOX_ACCESS_TOKEN` | Mapas y cálculo informativo en circuito. |
| `FIREBASE_SERVICE_ACCOUNT_*` | Envío de notificaciones push desde backend. |
| `SMTP_*` | Recuperación de contraseña y correos institucionales. |

## 8. Procedimiento De Release Recomendado

1. Verificar `.env` y variables cloud.
2. Ejecutar `npm run build`.
3. Ejecutar `npm run test:e2e`.
4. Ejecutar `cd frontend && npm run build`.
5. Revisar migraciones pendientes.
6. Confirmar volumen `UPLOADS_DIR` y permisos de escritura.
7. Desplegar backend.
8. Desplegar frontend.
9. Ejecutar smoke manual: login, health, circuito, pagos, asistencia y archivos privados.

## 9. Manejo De Incidentes

| Incidente | Revisión inicial |
| --- | --- |
| API no inicia | Variables de BD, migraciones, `JWT_SECRET`, logs Railway. |
| Frontend no conecta | `VITE_API_BASE`, CORS, URL del backend. |
| Archivos no abren | `UPLOADS_DIR`, ruta `/files`, permisos por rol y existencia física. |
| Push no llega | Token FCM web, cuenta de servicio, permisos del navegador. |
| Circuito falla | Estado del estudiante, asistencia del día, `circuit_enabled`, solicitud abierta previa. |
| Login falla tras lifecycle | Verificar `user.status`; el JWT se invalida si la cuenta queda inactiva. |

## 10. Consideraciones De Seguridad Operativa

No se deben versionar archivos `.env` reales, credenciales de Firebase, contraseñas, tokens SMTP ni
respaldos de base de datos. Los comprobantes, excusas y evidencias se consideran sensibles y deben
servirse mediante rutas autenticadas. Swagger debe quedar deshabilitado o protegido en producción.

## 11. Documentación Complementaria En El Repositorio

Para detalle adicional sin duplicar todo el contenido en este anexo, el repositorio incluye:

| Documento | Contenido principal |
| --- | --- |
| `docs/technical-setup.md` | Visión del monorepo, módulos registrados en `app.module.ts`, variables de entorno, arranque de `main.ts`, Swagger, prefijos de API (p. ej. `/api/v1/calendar/...`). |
| `docs/releases/runbook-railway-v1.3.md` | Runbook de despliegue Railway y comprobaciones post-release. |
| `docs/releases/checklist-operativo-post-release-v1.3.md` | Lista de verificación operativa tras publicar versión. |
| `docs/releases/archive/acta-*.md`, `parte-semanal-*.md` | Actas y seguimiento de estabilización (contexto histórico del proyecto). |

Regeneración de diagramas exportados para anexos y TDG: `python docs/tdg/export_mermaid_png.py` (requiere Node.js y `@mermaid-js/mermaid-cli` vía `npx`).
