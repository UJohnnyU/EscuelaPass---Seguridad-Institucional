import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'institution_settings' })
export class InstitutionSettingEntity {
  @PrimaryColumn({ name: 'setting_key', type: 'varchar', length: 64 })
  settingKey!: string;

  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
