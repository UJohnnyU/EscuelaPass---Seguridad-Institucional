import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum ExternalVisitAudienceScope {
  SCHOOL = 'SCHOOL',
  GROUPS = 'GROUPS',
  STUDENTS = 'STUDENTS'
}

export enum ExternalVisitStatus {
  PROGRAMADA = 'PROGRAMADA',
  REPROGRAMADA = 'REPROGRAMADA',
  REALIZADA = 'REALIZADA',
  CANCELADA = 'CANCELADA'
}

@Entity({ name: 'external_visits' })
export class ExternalVisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'creator_role', type: 'varchar', length: 20 })
  creatorRole!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'purpose', type: 'text' })
  purpose!: string;

  @Column({ name: 'visitor_name', type: 'varchar', length: 150 })
  visitorName!: string;

  @Column({ name: 'visitor_organization', type: 'varchar', length: 150, nullable: true })
  visitorOrganization!: string | null;

  @Column({ name: 'location', type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  @Column({ name: 'visit_datetime', type: 'timestamptz' })
  visitDatetime!: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 60 })
  durationMinutes!: number;

  @Column({ name: 'audience_scope', type: 'varchar', length: 16 })
  audienceScope!: ExternalVisitAudienceScope;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 16,
    default: ExternalVisitStatus.PROGRAMADA
  })
  status!: ExternalVisitStatus;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'previous_datetime', type: 'timestamptz', nullable: true })
  previousDatetime!: Date | null;

  @Column({ name: 'reminded_24h_at', type: 'timestamptz', nullable: true })
  reminded24hAt!: Date | null;

  @Column({ name: 'reminded_1h_at', type: 'timestamptz', nullable: true })
  reminded1hAt!: Date | null;

  @Column({ name: 'auto_finalized_at', type: 'timestamptz', nullable: true })
  autoFinalizedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
