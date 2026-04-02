import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum CredentialType {
  QR = 'QR',
  NFC = 'NFC'
}

export enum CredentialStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED'
}

@Entity({ name: 'access_credentials' })
export class AccessCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'credential_type', type: 'enum', enum: CredentialType })
  credentialType!: CredentialType;

  @Column({ name: 'credential_value', type: 'varchar', length: 500 })
  credentialValue!: string;

  @Column({ type: 'enum', enum: CredentialStatus, default: CredentialStatus.ACTIVE })
  status!: CredentialStatus;
}
