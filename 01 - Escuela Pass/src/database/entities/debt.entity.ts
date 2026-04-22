import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PaymentStatus {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  VENCIDO = 'VENCIDO',
  /** Comprobante revisado y no aceptado; el padre puede subir uno nuevo. */
  COMPROBANTE_RECHAZADO = 'COMPROBANTE_RECHAZADO'
}

@Entity({ name: 'debts' })
export class DebtEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'concept_id', type: 'uuid' })
  conceptId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDIENTE })
  status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'voucher_path', type: 'varchar', length: 500, nullable: true })
  voucherPath!: string | null;

  @Column({ name: 'uploaded_by_parent_id', type: 'uuid', nullable: true })
  uploadedByParentId!: string | null;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt!: Date | null;

  @Column({ name: 'verified_by_admin_id', type: 'uuid', nullable: true })
  verifiedByAdminId!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
