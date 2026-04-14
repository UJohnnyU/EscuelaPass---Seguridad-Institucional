import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AttentionSeverity {
  LEVE = 'LEVE',
  MODERADA = 'MODERADA',
  GRAVE = 'GRAVE'
}

@Entity({ name: 'student_attention_notes' })
export class StudentAttentionNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'enum', enum: AttentionSeverity, default: AttentionSeverity.LEVE })
  severity!: AttentionSeverity;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt!: Date;

  @Column({ name: 'notified_parent', type: 'boolean', default: true })
  notifiedParent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

