import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { StudentLifecycleStatus } from './student.entity';

@Entity({ name: 'student_lifecycle_events' })
@Index('ix_student_lifecycle_events_student', ['studentId'])
@Index('ix_student_lifecycle_events_school_created', ['schoolId', 'createdAt'])
export class StudentLifecycleEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 16 })
  fromStatus!: StudentLifecycleStatus;

  @Column({ name: 'to_status', type: 'varchar', length: 16 })
  toStatus!: StudentLifecycleStatus;

  @Column({ type: 'varchar', length: 240 })
  reason!: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({ name: 'changed_by_user_id', type: 'uuid' })
  changedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
