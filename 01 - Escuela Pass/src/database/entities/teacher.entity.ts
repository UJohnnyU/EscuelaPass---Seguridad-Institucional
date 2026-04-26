import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum TeacherLifecycleStatus {
  ACTIVO = 'ACTIVO',
  BAJA = 'BAJA',
  TRASLADO = 'TRASLADO',
  EGRESADO = 'EGRESADO'
}

@Entity({ name: 'teachers' })
export class TeacherEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'employee_number', type: 'varchar', length: 50, unique: true })
  employeeNumber!: string;

  @Column({ name: 'lifecycle_status', type: 'varchar', length: 16, default: TeacherLifecycleStatus.ACTIVO })
  lifecycleStatus!: TeacherLifecycleStatus;
}
