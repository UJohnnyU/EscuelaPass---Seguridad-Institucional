import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum MeetingStatus {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  REALIZADA = 'REALIZADA',
  CANCELADA = 'CANCELADA'
}

@Entity({ name: 'parent_teacher_meetings' })
export class ParentTeacherMeetingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'meeting_datetime', type: 'timestamptz' })
  meetingDatetime!: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 30 })
  durationMinutes!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: MeetingStatus, default: MeetingStatus.PENDIENTE })
  status!: MeetingStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
