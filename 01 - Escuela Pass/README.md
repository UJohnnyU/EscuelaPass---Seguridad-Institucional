# Escuela Pass (backend + frontend)

Aplicación institucional: control de accesos, circuito de recogida, comunicación, académico, finanzas y más.

## Estructura

| Ruta | Contenido |
|------|-----------|
| `src/` | API NestJS (TypeORM, módulos por dominio). |
| `frontend/` | SPA React (Vite). |
| `docs/` | Documentación técnica, runbooks y convenciones. |
| `scripts/` | Utilidades Node (BD, seeds de demo — **solo dev/staging**). |
| `escuela_pass_schema_v4.sql` | DDL de referencia completo para greenfield (`npm run db:apply`). |
| `src/database/baseline/typeorm-baseline-v3.sql` | DDL histórico **solo** para la primera migración TypeORM y E2E (ver carpeta `baseline/`). |

## Puesta en marcha

1. Variables: copie `.env.example` → `.env`.
2. Base de datos: hay **dos caminos** válidos (v4 con `db:apply` o migraciones desde base vacía). Detalle en [`docs/technical-setup.md`](docs/technical-setup.md).
3. API: `npm install` y `npm run start:dev` (desde esta carpeta).
4. Web: `cd frontend`, `npm install`, `npm run dev`.

Despliegue Railway y checklist: [`docs/releases/README.md`](docs/releases/README.md).

## Artefactos que no son de producción operativa

- Seeds (`scripts/database/*.sql`, `seed-full-demo.cjs`, etc.): ver cabezales en cada archivo; no ejecutar en producción sin criterio.
- `typeorm-baseline-v3.sql`: no sustituye al esquema v4 como documentación del estado actual del producto.

## Convención de comentarios en código

Ver [`docs/CODESTYLE-COMMENTS.md`](docs/CODESTYLE-COMMENTS.md). Índice breve de documentación: [`docs/README.md`](docs/README.md).
