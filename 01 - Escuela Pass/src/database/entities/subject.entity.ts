import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'subjects' })
export class SubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Clave institucional corta de la materia (ej. MAT-101). */
  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  /** Nivel educativo al que pertenece la asignatura (Primaria, Secundaria, etc.). */
  @Column({ name: 'education_level', type: 'varchar', length: 80, nullable: true })
  educationLevel!: string | null;

  /** Grado/ciclo objetivo (ej. 1°, 2°, Bachillerato, etc.). */
  @Column({ name: 'grade_scope', type: 'varchar', length: 80, nullable: true })
  gradeScope!: string | null;

  /** Área académica (ej. Ciencias, Humanidades, etc.). */
  @Column({ type: 'varchar', length: 80, nullable: true })
  area!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
