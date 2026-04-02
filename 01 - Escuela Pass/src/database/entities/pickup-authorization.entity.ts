import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'pickup_authorizations' })
export class PickupAuthorizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;
}
