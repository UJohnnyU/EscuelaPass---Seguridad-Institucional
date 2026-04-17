import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum ActivityStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

@Entity({ name: 'activities' })
@Index('ix_activities_group_status', ['groupId', 'status'])
@Index('ix_activities_teacher', ['teacherId'])
export class ActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string;

  @Column({ name: 'subject_name', type: 'varchar', length: 100 })
  subjectName!: string;

  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId!: string | null;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 50 })
  period!: string;

  @Column({ name: 'max_score', type: 'decimal', precision: 6, scale: 2 })
  maxScore!: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'varchar', length: 16, default: ActivityStatus.OPEN })
  status!: ActivityStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @Column({ name: 'reopened_at', type: 'timestamptz', nullable: true })
  reopenedAt!: Date | null;

  @Column({ name: 'reopened_by', type: 'uuid', nullable: true })
  reopenedBy!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
