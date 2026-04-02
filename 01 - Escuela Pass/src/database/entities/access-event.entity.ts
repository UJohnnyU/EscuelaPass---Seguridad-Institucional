import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from './user.entity';

export enum AccessEventType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}

export enum AccessMethod {
  QR = 'QR',
  NFC = 'NFC',
  MANUAL = 'MANUAL'
}

@Entity({ name: 'access_events' })
export class AccessEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'role_snapshot', type: 'enum', enum: UserRole })
  roleSnapshot!: UserRole;

  @Column({ name: 'event_type', type: 'enum', enum: AccessEventType })
  eventType!: AccessEventType;

  @Column({ type: 'enum', enum: AccessMethod })
  method!: AccessMethod;

  @Column({ name: 'event_time', type: 'timestamptz' })
  eventTime!: Date;

  @Column({ name: 'event_date', type: 'date' })
  eventDate!: string;

  @Column({ name: 'access_credential_id', type: 'uuid', nullable: true })
  accessCredentialId!: string | null;

  @Column({ name: 'registered_by', type: 'uuid', nullable: true })
  registeredBy!: string | null;
}
