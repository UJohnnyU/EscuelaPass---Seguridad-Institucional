import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TeacherLifecycleStatus } from './teacher.entity';

@Entity({ name: 'teacher_lifecycle_events' })
@Index('ix_teacher_lifecycle_events_teacher', ['teacherId'])
@Index('ix_teacher_lifecycle_events_school_created', ['schoolId', 'createdAt'])
export class TeacherLifecycleEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 16 })
  fromStatus!: TeacherLifecycleStatus;

  @Column({ name: 'to_status', type: 'varchar', length: 16 })
  toStatus!: TeacherLifecycleStatus;

  @Column({ type: 'varchar', length: 240 })
  reason!: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({ name: 'changed_by_user_id', type: 'uuid' })
  changedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
