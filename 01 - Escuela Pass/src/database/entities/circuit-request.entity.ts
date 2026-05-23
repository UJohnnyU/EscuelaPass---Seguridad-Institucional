/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
  /** Plazo de confirmación del padre vencido; el circuito queda cerrado sin acuse de recibimiento. */
  CERRADO_SIN_CONFIRMACION_PADRE = 'CERRADO_SIN_CONFIRMACION_PADRE',
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

  /** Instantánea de GPS al marcar «llegué» (validación del docente en mapa). */
  @Column({ name: 'arrival_snapshot_latitude', type: 'numeric', precision: 10, scale: 8, nullable: true })
  arrivalSnapshotLatitude!: string | null;

  @Column({ name: 'arrival_snapshot_longitude', type: 'numeric', precision: 11, scale: 8, nullable: true })
  arrivalSnapshotLongitude!: string | null;

  @Column({ name: 'arrival_snapshot_at', type: 'timestamptz', nullable: true })
  arrivalSnapshotAt!: Date | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ name: 'pickup_vehicle_description', type: 'varchar', length: 120, nullable: true })
  pickupVehicleDescription!: string | null;

  @Column({ name: 'pickup_notes', type: 'varchar', length: 240, nullable: true })
  pickupNotes!: string | null;

  @Column({ name: 'teacher_signal', type: 'varchar', length: 40, nullable: true })
  teacherSignal!: string | null;

  /** Si el alumno está en tránsito (EN_CAMINO), momento límite para que el padre confirme recibimiento. */
  @Column({ name: 'parent_confirm_deadline_at', type: 'timestamptz', nullable: true })
  parentConfirmDeadlineAt!: Date | null;

  /**
   * Inicio del plazo cuando concurrieron EN_CAMINO y señal ALUMNO_CAMINO_A_SALIDA (confirmación de recibimiento).
   * Debe alinearse con el cálculo de `parentConfirmDeadlineAt`; ausente en filas legadas corregidas por migración.
   */
  @Column({ name: 'parent_confirm_deadline_started_at', type: 'timestamptz', nullable: true })
  parentConfirmDeadlineStartedAt!: Date | null;

  /** Momento en que el padre confirmó haber recibido al menor (ENTREGADO). */
  @Column({ name: 'parent_receipt_confirmed_at', type: 'timestamptz', nullable: true })
  parentReceiptConfirmedAt!: Date | null;
}
