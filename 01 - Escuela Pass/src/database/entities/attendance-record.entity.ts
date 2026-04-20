import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AttendanceStatus {
  PRESENTE = 'PRESENTE',
  AUSENTE = 'AUSENTE',
  RETARDO = 'RETARDO'
}

@Entity({ name: 'attendance_records' })
export class AttendanceRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENTE })
  status!: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Comprobante opcional (PDF/imagen) para ausencia justificada cargado por el padre. */
  @Column({ name: 'excuse_attachment_path', type: 'varchar', length: 500, nullable: true })
  excuseAttachmentPath!: string | null;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
