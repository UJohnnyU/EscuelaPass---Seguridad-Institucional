import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentAttentionNotes1776400000000 implements MigrationInterface {
  name = 'StudentAttentionNotes1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE attention_severity AS ENUM ('LEVE', 'MODERADA', 'GRAVE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS student_attention_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        severity attention_severity NOT NULL DEFAULT 'LEVE',
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notified_parent BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_student_attention_notes_student
      ON student_attention_notes(student_id, occurred_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_student_attention_notes_student`);
    await queryRunner.query(`DROP TABLE IF EXISTS student_attention_notes`);
    await queryRunner.query(`
      DO $$
      BEGIN
        DROP TYPE IF EXISTS attention_severity;
      EXCEPTION WHEN undefined_object THEN NULL;
      END $$;
    `);
  }
}

