import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum StudentLifecycleStatus {
  ACTIVO = 'ACTIVO',
  BAJA = 'BAJA',
  TRASLADO = 'TRASLADO',
  EGRESADO = 'EGRESADO'
}

@Entity({ name: 'students' })
export class StudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  matricula!: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ name: 'can_leave_alone', type: 'boolean', default: false })
  canLeaveAlone!: boolean;

  @Column({ name: 'lifecycle_status', type: 'varchar', length: 16, default: StudentLifecycleStatus.ACTIVO })
  lifecycleStatus!: StudentLifecycleStatus;
}
