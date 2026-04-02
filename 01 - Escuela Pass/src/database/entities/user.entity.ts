import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  DOCENTE = 'DOCENTE',
  PADRE = 'PADRE',
  ALUMNO = 'ALUMNO'
}

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'can_access_campus', type: 'boolean', default: false })
  canAccessCampus!: boolean;

  @Column({ name: 'status', type: 'boolean', default: true })
  status!: boolean;
}
