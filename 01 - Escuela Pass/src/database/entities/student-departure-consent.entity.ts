import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ConsentType {
  SALIDA_SOLO = 'SALIDA_SOLO',
  SALIDA_CON_OTRA_PERSONA = 'SALIDA_CON_OTRA_PERSONA'
}

@Entity({ name: 'student_departure_consents' })
@Index('ix_student_departure_consents_student_dates', ['studentId', 'validFrom', 'validUntil'])
export class StudentDepartureConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Column({ name: 'consent_type', type: 'enum', enum: ConsentType })
  consentType!: ConsentType;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom!: string;

  @Column({ name: 'valid_until', type: 'date' })
  validUntil!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
