import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'groups' })
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'school_year', type: 'varchar', length: 20 })
  schoolYear!: string;
}
