import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentMatriculaBySchool1777700000000 implements MigrationInterface {
  name = 'StudentMatriculaBySchool1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id uuid`);
    await queryRunner.query(`
      UPDATE students s
      SET school_id = u.school_id
      FROM users u
      WHERE u.id = s.user_id
        AND s.school_id IS NULL
    `);
    await queryRunner.query(`ALTER TABLE students ALTER COLUMN school_id SET NOT NULL`);
    await queryRunner.query(`
      DO $$
      DECLARE con_name text;
      BEGIN
        SELECT c.conname
          INTO con_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname = 'students'
          AND c.contype = 'u'
          AND (
            array_length(c.conkey, 1) = 1
            AND (
              SELECT a.attname
              FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = c.conkey[1]
            ) = 'matricula'
          )
        LIMIT 1;

        IF con_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE students DROP CONSTRAINT %I', con_name);
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_students_school_id ON students (school_id)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_matricula ON students (school_id, matricula)`
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE students
            ADD CONSTRAINT fk_students_school_id
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_school_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_students_school_matricula`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_students_school_id`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE students
            ADD CONSTRAINT uq_students_matricula UNIQUE (matricula);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN IF EXISTS school_id`);
  }
}
