import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'teacher_subjects' })
@Index('uq_teacher_subjects_teacher_subject', ['teacherId', 'subjectId'], { unique: true })
export class TeacherSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
