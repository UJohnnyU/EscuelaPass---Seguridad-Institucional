import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'teachers' })
export class TeacherEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;
}
