import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AdminReportStatus {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  RESUELTO = 'RESUELTO'
}

export enum AdminReportType {
  ERROR = 'ERROR',
  SUGERENCIA = 'SUGERENCIA',
  PETICION = 'PETICION',
  OTRO = 'OTRO'
}

@Entity({ name: 'admin_reports' })
@Index('ix_admin_reports_school_status', ['schoolId', 'status'])
@Index('ix_admin_reports_created_by', ['createdByUserId'])
export class AdminReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'assigned_admin_user_id', type: 'uuid', nullable: true })
  assignedAdminUserId!: string | null;

  @Column({ type: 'varchar', length: 16, default: AdminReportType.OTRO })
  type!: AdminReportType;

  @Column({ type: 'varchar', length: 160 })
  subject!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 16, default: AdminReportStatus.PENDIENTE })
  status!: AdminReportStatus;

  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
