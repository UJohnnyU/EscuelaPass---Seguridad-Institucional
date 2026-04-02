import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'teachers' })
export class TeacherEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'employee_number', type: 'varchar', length: 50, unique: true })
  employeeNumber!: string;
}
