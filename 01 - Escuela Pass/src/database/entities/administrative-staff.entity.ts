import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'administrative_staff' })
export class AdministrativeStaffEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;
}
