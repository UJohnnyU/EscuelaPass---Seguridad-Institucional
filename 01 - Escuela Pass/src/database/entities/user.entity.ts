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

  /** Celular o teléfono de contacto (visible según reglas de perfil). */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'can_access_campus', type: 'boolean', default: false })
  canAccessCampus!: boolean;

  @Column({ name: 'status', type: 'boolean', default: true })
  status!: boolean;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId!: string | null;

  /** Ruta pública bajo `/uploads/avatars/…` */
  @Column({ name: 'avatar_path', type: 'varchar', length: 500, nullable: true })
  avatarPath!: string | null;

  @Column({ name: 'password_reset_token', type: 'varchar', length: 128, nullable: true })
  passwordResetToken!: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true })
  passwordResetExpiresAt!: Date | null;
}
