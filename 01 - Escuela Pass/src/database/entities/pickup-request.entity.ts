import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum PickupRequestStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA'
}

@Entity({ name: 'visit_requests' })
export class PickupRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_visit_requests_parent')
  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Index('ix_visit_requests_student')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'visit_datetime', type: 'timestamptz' })
  visitDatetime!: Date;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: PickupRequestStatus.PENDIENTE
  })
  status!: PickupRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
