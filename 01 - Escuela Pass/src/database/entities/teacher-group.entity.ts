import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'teacher_groups' })
export class TeacherGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId!: string | null;

  @Column({ name: 'is_main_teacher', type: 'boolean', default: false })
  isMainTeacher!: boolean;

  @Column({ name: 'can_authorize_departures', type: 'boolean', default: false })
  canAuthorizeDepartures!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
