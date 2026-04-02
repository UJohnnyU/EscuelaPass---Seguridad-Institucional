import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'students' })
export class StudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  matricula!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;
}
