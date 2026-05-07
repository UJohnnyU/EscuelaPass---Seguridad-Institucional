'use strict';
/**
 * Seed completo con **2 escuelas** (San José + Colegio Técnico Nacional).
 * Reutiliza `seed-full-demo.cjs` (vacía tablas vía TRUNCATE y repuebla todo).
 *
 * Contraseña demo de todos los usuarios: Escuela2026!
 *
 * Requisitos:
 *   • Migraciones TypeORM ya aplicadas sobre la misma DATABASE_URL.
 *   • `DATABASE_URL` o `POSTGRES_URL` en el entorno (Railway lo inyecta solo).
 *
 * Ejemplos:
 *   npm run db:seed:railway
 *   railway run npm run db:seed:railway
 */
process.env.SEED_NUM_SCHOOLS = process.env.SEED_NUM_SCHOOLS || '2';
require('./seed-full-demo.cjs');
