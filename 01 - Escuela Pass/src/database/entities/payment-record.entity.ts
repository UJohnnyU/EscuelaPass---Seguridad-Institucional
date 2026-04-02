import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'payments' })
export class PaymentRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'debt_id', type: 'uuid' })
  debtId!: string;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate!: string;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2 })
  amountPaid!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod!: string | null;

  @Column({ name: 'voucher_path', type: 'varchar', length: 500, nullable: true })
  voucherPath!: string | null;

  @Column({ name: 'reference_number', type: 'varchar', length: 100, nullable: true })
  referenceNumber!: string | null;

  @Column({ name: 'verified_by_admin_id', type: 'uuid', nullable: true })
  verifiedByAdminId!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
