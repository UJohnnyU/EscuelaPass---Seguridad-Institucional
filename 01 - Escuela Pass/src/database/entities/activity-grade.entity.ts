import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'activity_grades' })
@Index('uq_activity_grades_activity_student', ['activityId', 'studentId'], { unique: true })
@Index('ix_activity_grades_student', ['studentId'])
export class ActivityGradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'activity_id', type: 'uuid' })
  activityId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  score!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'graded_by', type: 'uuid', nullable: true })
  gradedBy!: string | null;

  @Column({ name: 'graded_at', type: 'timestamptz' })
  gradedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
