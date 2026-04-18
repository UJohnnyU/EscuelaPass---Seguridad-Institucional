import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum MeetingModality {
  PRESENCIAL = 'PRESENCIAL',
  VIRTUAL = 'VIRTUAL'
}

export enum MeetingStatus {
  PROGRAMADA = 'PROGRAMADA',
  REPROGRAMADA = 'REPROGRAMADA',
  EN_CURSO = 'EN_CURSO',
  REALIZADA = 'REALIZADA',
  CANCELADA = 'CANCELADA'
}

@Entity({ name: 'meetings' })
export class MeetingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @Column({ name: 'organizer_user_id', type: 'uuid' })
  organizerUserId!: string;

  @Column({ name: 'organizer_role', type: 'varchar', length: 20 })
  organizerRole!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'purpose', type: 'text' })
  purpose!: string;

  @Column({
    name: 'modality',
    type: 'varchar',
    length: 16,
    default: MeetingModality.PRESENCIAL
  })
  modality!: MeetingModality;

  @Column({ name: 'location', type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  @Column({ name: 'meeting_link', type: 'varchar', length: 500, nullable: true })
  meetingLink!: string | null;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 30 })
  durationMinutes!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 16,
    default: MeetingStatus.PROGRAMADA
  })
  status!: MeetingStatus;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'previous_start_at', type: 'timestamptz', nullable: true })
  previousStartAt!: Date | null;

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
