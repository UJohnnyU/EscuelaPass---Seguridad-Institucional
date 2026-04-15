import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'parents' })
export class ParentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'is_primary_contact', type: 'boolean', default: false })
  isPrimaryContact!: boolean;
}
