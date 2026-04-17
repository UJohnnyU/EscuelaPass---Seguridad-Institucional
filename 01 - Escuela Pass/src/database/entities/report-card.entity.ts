import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum ReportCardType {
  PERIOD = 'PERIOD',
  FINAL = 'FINAL'
}

export enum ReportCardStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED'
}

export enum PromotionStatus {
  APROBADO = 'APROBADO',
  APROBADO_CON_PENDIENTES = 'APROBADO_CON_PENDIENTES',
  REPROBADO = 'REPROBADO'
}

@Entity({ name: 'report_cards' })
@Index('uq_report_cards_student_type_period_year', ['studentId', 'type', 'periodId', 'schoolYear'], {
  unique: true
})
@Index('ix_report_cards_student', ['studentId'])
@Index('ix_report_cards_school_year', ['schoolId', 'schoolYear'])
export class ReportCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'school_year', type: 'varchar', length: 20 })
  schoolYear!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: ReportCardType;

  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId!: string | null;

  @Column({ name: 'overall_average', type: 'decimal', precision: 6, scale: 2, default: 0 })
  overallAverage!: string;

  @Column({ name: 'failed_subjects_count', type: 'int', default: 0 })
  failedSubjectsCount!: number;

  @Column({ name: 'promotion_status', type: 'varchar', length: 32, nullable: true })
  promotionStatus!: PromotionStatus | null;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: ReportCardStatus.DRAFT })
  status!: ReportCardStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
