import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum VisitRequestStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  REALIZADA = 'REALIZADA',
  CANCELADA = 'CANCELADA'
}

@Entity({ name: 'visit_requests' })
export class VisitRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'visit_datetime', type: 'timestamptz' })
  visitDatetime!: Date;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'enum', enum: VisitRequestStatus, default: VisitRequestStatus.PENDIENTE })
  status!: VisitRequestStatus;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
