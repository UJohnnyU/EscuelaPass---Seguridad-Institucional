import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade PADRE_EN_CAMINO al enum circuit_status.
 * Requiere ser **dueño** del tipo o superusuario. Si el tipo lo creó `postgres` y migras con otro usuario,
 * ejecuta una vez como superusuario:
 *   ALTER TYPE circuit_status ADD VALUE IF NOT EXISTS 'PADRE_EN_CAMINO';
 * Luego vuelve a ejecutar `npm run migration:run` (la migración detectará el valor y no hará nada).
 */
export class CircuitPadreEnCamino1776100000000 implements MigrationInterface {
  name = 'CircuitPadreEnCamino1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'circuit_status' AND e.enumlabel = 'PADRE_EN_CAMINO'
      ) AS ok
    `);
    if (exists[0]?.ok === true) {
      return;
    }

    try {
      await queryRunner.query(`ALTER TYPE circuit_status ADD VALUE 'PADRE_EN_CAMINO'`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === '42501') {
        throw new Error(
          'Migración CircuitPadreEnCamino: el usuario de BD no es dueño del tipo circuit_status. ' +
            'Conéctese como postgres (o el dueño del tipo) y ejecute:\n' +
            "  ALTER TYPE circuit_status ADD VALUE IF NOT EXISTS 'PADRE_EN_CAMINO';\n" +
            'Opcionalmente: ALTER TYPE circuit_status OWNER TO <usuario_app>;\n' +
            'Después ejecute de nuevo: npm run migration:run'
        );
      }
      throw err;
    }
  }

  public async down(): Promise<void> {
    // Quitar un valor de ENUM en PostgreSQL requiere recrear el tipo; no se revierte aquí.
  }
}
