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
