import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum MeetingParticipantRsvp {
  PENDIENTE = 'PENDIENTE',
  ACEPTADA = 'ACEPTADA',
  DECLINADA = 'DECLINADA',
  NO_ASISTIO = 'NO_ASISTIO'
}

@Entity({ name: 'meeting_participants' })
@Index('uq_meeting_participants_user', ['meetingId', 'userId'], { unique: true })
export class MeetingParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'meeting_id', type: 'uuid' })
  meetingId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'participant_role', type: 'varchar', length: 20 })
  participantRole!: string;

  @Column({ name: 'student_context_id', type: 'uuid', nullable: true })
  studentContextId!: string | null;

  @Column({
    name: 'rsvp',
    type: 'varchar',
    length: 16,
    default: MeetingParticipantRsvp.PENDIENTE
  })
  rsvp!: MeetingParticipantRsvp;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
