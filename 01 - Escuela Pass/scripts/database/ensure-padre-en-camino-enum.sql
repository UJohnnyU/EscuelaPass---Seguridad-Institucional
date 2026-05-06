-- =============================================================
-- Añade PADRE_EN_CAMINO a circuit_status si aún no existe.
-- Uso: ejecutar como superusuario o como dueño del tipo cuando
--      `npm run migration:run` falle en CircuitPadreEnCamino (p. ej. 42501).
--      Luego repetir `npm run migration:run`.
-- Ver: src/database/migrations/1776100000000-CircuitPadreEnCamino.ts
-- =============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'circuit_status' AND e.enumlabel = 'PADRE_EN_CAMINO'
     ) THEN
    ALTER TYPE circuit_status ADD VALUE 'PADRE_EN_CAMINO';
  END IF;
END $$;
