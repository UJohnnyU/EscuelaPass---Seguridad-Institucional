import { IsEnum } from 'class-validator';
import { MeetingParticipantRsvp } from '../../../database/entities/meeting-participant.entity';

export class MeetingRsvpDto {
  @IsEnum({
    [MeetingParticipantRsvp.PENDIENTE]: MeetingParticipantRsvp.PENDIENTE,
    [MeetingParticipantRsvp.ACEPTADA]: MeetingParticipantRsvp.ACEPTADA,
    [MeetingParticipantRsvp.DECLINADA]: MeetingParticipantRsvp.DECLINADA
  })
  rsvp!: MeetingParticipantRsvp;
}
