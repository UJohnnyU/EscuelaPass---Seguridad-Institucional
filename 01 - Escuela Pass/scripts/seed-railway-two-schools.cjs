'use strict';
/**
 * Seed completo con **2 escuelas** (San José + Colegio Técnico Nacional).
 * Reutiliza `seed-full-demo.cjs` (vacía tablas vía TRUNCATE y repuebla todo).
 *
 * Contraseña demo de todos los usuarios: Escuela2026!
 *
 * Requisitos:
 *   • Migraciones TypeORM recomendadas en producción; el seed añade por si acaso las
 *     columnas de horarios de turno en `schools` si faltan (misma lógica que la migración).
 *   • Nunca apuntes `DATABASE_URL` del e2e (`pretest:e2e`) a esta misma BD: hace
 *     `DROP SCHEMA public` y destruye el esquema. Tras eso, en Railway ejecuta primero
 *     `npm run migration:run` (o reaplica el baseline) y luego este seed.
 *
 * Ejemplos:
 *   npm run db:seed:railway
 *   railway run npm run db:seed:railway
 */
process.env.SEED_NUM_SCHOOLS = process.env.SEED_NUM_SCHOOLS || '2';
require('./seed-full-demo.cjs');
