import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_privacy_acceptances' })
export class UserPrivacyAcceptanceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'policy_version', type: 'varchar', length: 32 })
  policyVersion!: string;

  @CreateDateColumn({ name: 'accepted_at', type: 'timestamptz' })
  acceptedAt!: Date;

  /** PG `inet` se lee como string; tipar como varchar evita valores no serializables en JSON. */
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;
}
