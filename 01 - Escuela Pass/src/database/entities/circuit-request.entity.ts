import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum PickupMethod {
  VEHICULO_REGISTRADO = 'VEHICULO_REGISTRADO',
  OTRO_VEHICULO = 'OTRO_VEHICULO',
  A_PIE = 'A_PIE',
  /** Legado en BD; no usar en nuevas solicitudes (no transporte escolar). */
  TRANSPORTE_PUBLICO = 'TRANSPORTE_PUBLICO',
  SOLO_CONSENTIMIENTO = 'SOLO_CONSENTIMIENTO'
}

/** Valores permitidos al crear una solicitud (padres como conductores; sin transporte escolar). */
export const PICKUP_METHOD_CREATE = [
  PickupMethod.VEHICULO_REGISTRADO,
  PickupMethod.OTRO_VEHICULO,
  PickupMethod.A_PIE,
  PickupMethod.SOLO_CONSENTIMIENTO
] as const;

export enum CircuitStatus {
  PENDIENTE = 'PENDIENTE',
  /** El padre avisó que va en camino al plantel (sin usar GPS para cambiar estado). */
  PADRE_EN_CAMINO = 'PADRE_EN_CAMINO',
  NOTIFICADO_LLEGADA = 'NOTIFICADO_LLEGADA',
  AUTORIZADO_SALIR = 'AUTORIZADO_SALIR',
  EN_CAMINO = 'EN_CAMINO',
  ENTREGADO = 'ENTREGADO',
  CONSENTIDO_SOLO = 'CONSENTIDO_SOLO',
  CANCELADO = 'CANCELADO'
}

/** Señales del docente hacia el circuito (sin confundir con proximidad del vehículo). */
export enum TeacherCircuitSignal {
  PREPARA_SALIDA = 'PREPARA_SALIDA',
  ALUMNO_CAMINO_A_SALIDA = 'ALUMNO_CAMINO_A_SALIDA'
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

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ name: 'teacher_signal', type: 'varchar', length: 40, nullable: true })
  teacherSignal!: string | null;
}
