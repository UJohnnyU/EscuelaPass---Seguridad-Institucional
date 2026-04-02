import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum PickupMethod {
  VEHICULO_REGISTRADO = 'VEHICULO_REGISTRADO',
  OTRO_VEHICULO = 'OTRO_VEHICULO',
  A_PIE = 'A_PIE',
  TRANSPORTE_PUBLICO = 'TRANSPORTE_PUBLICO',
  SOLO_CONSENTIMIENTO = 'SOLO_CONSENTIMIENTO'
}

export enum CircuitStatus {
  PENDIENTE = 'PENDIENTE',
  NOTIFICADO_LLEGADA = 'NOTIFICADO_LLEGADA',
  AUTORIZADO_SALIR = 'AUTORIZADO_SALIR',
  EN_CAMINO = 'EN_CAMINO',
  ENTREGADO = 'ENTREGADO',
  CONSENTIDO_SOLO = 'CONSENTIDO_SOLO',
  CANCELADO = 'CANCELADO'
}

@Entity({ name: 'circuit_requests' })
export class CircuitRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'requested_by_parent_id', type: 'uuid' })
  requestedByParentId!: string;

  @Column({ name: 'pickup_method', type: 'enum', enum: PickupMethod })
  pickupMethod!: PickupMethod;

  @Column({ type: 'enum', enum: CircuitStatus, default: CircuitStatus.PENDIENTE })
  status!: CircuitStatus;

  @Column({ name: 'request_time', type: 'timestamptz' })
  requestTime!: Date;

  @Column({ name: 'parent_gps_latitude', type: 'numeric', precision: 10, scale: 8, nullable: true })
  parentGpsLatitude!: string | null;

  @Column({ name: 'parent_gps_longitude', type: 'numeric', precision: 11, scale: 8, nullable: true })
  parentGpsLongitude!: string | null;
}
