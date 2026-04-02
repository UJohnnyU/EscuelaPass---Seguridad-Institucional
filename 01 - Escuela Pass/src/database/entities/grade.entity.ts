import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'grades' })
export class GradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  subject!: string;

  @Column({ type: 'varchar', length: 50 })
  period!: string;

  @Column({ name: 'assessment_name', type: 'varchar', length: 120 })
  assessmentName!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score!: string;

  @Column({ name: 'max_score', type: 'decimal', precision: 5, scale: 2, default: 100 })
  maxScore!: string;

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