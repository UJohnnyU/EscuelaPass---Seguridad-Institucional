import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AttendanceStatus } from './attendance-record.entity';

@Entity({ name: 'class_attendance_records' })
export class ClassAttendanceRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId!: string;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENTE })
  status!: AttendanceStatus;

  @Column({ name: 'is_justified', type: 'boolean', default: false })
  isJustified!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'excuse_attachment_path', type: 'varchar', length: 500, nullable: true })
  excuseAttachmentPath!: string | null;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
