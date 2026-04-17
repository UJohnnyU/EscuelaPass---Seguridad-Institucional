import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum AcademicPeriodStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED'
}

@Entity({ name: 'academic_periods' })
@Index('uq_academic_periods_school_year_order', ['schoolId', 'schoolYear', 'orderIndex'], {
  unique: true
})
@Index('ix_academic_periods_status', ['schoolId', 'status'])
export class AcademicPeriodEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'school_year', type: 'varchar', length: 20 })
  schoolYear!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex!: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  weight!: string;

  @Column({ type: 'varchar', length: 16, default: AcademicPeriodStatus.PLANNED })
  status!: AcademicPeriodStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
