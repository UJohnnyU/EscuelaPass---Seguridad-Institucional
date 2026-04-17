import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'report_card_subjects' })
@Index('uq_report_card_subjects_rc_subject', ['reportCardId', 'subjectId'], { unique: true })
export class ReportCardSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_card_id', type: 'uuid' })
  reportCardId!: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string;

  @Column({ name: 'subject_name', type: 'varchar', length: 100 })
  subjectName!: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  average!: string;

  @Column({ name: 'activity_count', type: 'int', default: 0 })
  activityCount!: number;

  @Column({ name: 'graded_count', type: 'int', default: 0 })
  gradedCount!: number;

  @Column({ name: 'is_passing', type: 'boolean', default: false })
  isPassing!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
