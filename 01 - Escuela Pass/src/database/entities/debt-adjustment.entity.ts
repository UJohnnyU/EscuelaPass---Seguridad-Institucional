import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum DebtAdjustmentActionType {
  LATE_FEE = 'LATE_FEE',
  ARRANGEMENT = 'ARRANGEMENT',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  STATUS_CHANGE = 'STATUS_CHANGE'
}

@Entity({ name: 'debt_adjustments' })
@Index('ix_debt_adjustments_debt_created', ['debtId', 'createdAt'])
@Index('ix_debt_adjustments_school_created', ['schoolId', 'createdAt'])
export class DebtAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'debt_id', type: 'uuid' })
  debtId!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'action_type', type: 'varchar', length: 32 })
  actionType!: DebtAdjustmentActionType;

  @Column({ name: 'previous_amount', type: 'decimal', precision: 10, scale: 2 })
  previousAmount!: string;

  @Column({ name: 'delta_amount', type: 'decimal', precision: 10, scale: 2 })
  deltaAmount!: string;

  @Column({ name: 'next_amount', type: 'decimal', precision: 10, scale: 2 })
  nextAmount!: string;

  @Column({ type: 'varchar', length: 300 })
  reason!: string;

  @Column({ name: 'policy_cycle_date', type: 'date', nullable: true })
  policyCycleDate!: string | null;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
