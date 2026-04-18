import { IsEnum } from 'class-validator';
import { MeetingParticipantRsvp } from '../../../database/entities/meeting-participant.entity';

export class MeetingRsvpDto {
  @IsEnum(MeetingParticipantRsvp)
  rsvp!: MeetingParticipantRsvp;
}
