import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'schools' })
export class SchoolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  code!: string;

  @Column({ type: 'boolean', default: true })
  status!: boolean;

  /** Estado del circuito por institución (independiente de otras escuelas). */
  @Column({ name: 'circuit_enabled', type: 'boolean', default: true })
  circuitEnabled!: boolean;

  /**
   * Si es true, solo se puede iniciar el circuito de recogida si existe una solicitud de
   * retiro anticipado APROBADA para el mismo día (visit_requests).
   */
  @Column({ name: 'circuit_requires_early_pickup_approval', type: 'boolean', default: false })
  circuitRequiresEarlyPickupApproval!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  phone!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: false })
  latitude!: string;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: false })
  longitude!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ name: 'director_name', type: 'varchar', length: 200, nullable: true })
  directorName!: string | null;

  @Column({ name: 'student_matricula_prefix', type: 'varchar', length: 20, nullable: true })
  studentMatriculaPrefix!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  motto!: string | null;

  /** Escala institucional para calificar actividades (0..max), con 2 decimales. */
  @Column({ name: 'max_grade_scale', type: 'decimal', precision: 5, scale: 2, default: 100 })
  maxGradeScale!: string;

  /** Nota minima aprobatoria (0..max_grade_scale). */
  @Column({ name: 'passing_grade', type: 'decimal', precision: 5, scale: 2, default: 0 })
  passingGrade!: string;

  /** Minimo de materias reprobadas en el boletin final para marcar REPROBADO. */
  @Column({ name: 'min_failed_subjects_to_repeat', type: 'int', default: 3 })
  minFailedSubjectsToRepeat!: number;

  /** Ruta pública bajo `/uploads/school-logos/…` */
  @Column({ name: 'logo_path', type: 'varchar', length: 500, nullable: true })
  logoPath!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
