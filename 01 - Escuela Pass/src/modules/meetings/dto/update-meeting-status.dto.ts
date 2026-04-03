import { IsIn } from 'class-validator';
import { MeetingStatus } from '../../../database/entities/parent-teacher-meeting.entity';

export class UpdateMeetingStatusDto {
  @IsIn([MeetingStatus.CONFIRMADA, MeetingStatus.REALIZADA, MeetingStatus.CANCELADA])
  status!: MeetingStatus;
}
