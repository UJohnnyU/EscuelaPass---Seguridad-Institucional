# Baseline SQL (TypeORM)

- **`typeorm-baseline-v3.sql`** — DDL histórico congelado aplicado solo por la migración `1712050000000-BaselineSchema` al ejecutar `npm run migration:run` sobre una base vacía.
- El archivo se copia a `dist/database/baseline/` en `npm run build` del API vía `nest-cli.json` (`compilerOptions.assets`).
- No es la fuente de verdad documental del producto; para esquema completo actualizado use `escuela_pass_schema_v4.sql` en la raíz del proyecto (`npm run db:apply`).
