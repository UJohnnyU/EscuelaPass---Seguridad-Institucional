import { IsIn } from 'class-validator';

export type MeetingStatusAction = 'IN_PROGRESS' | 'REALIZED';

export class MeetingStatusDto {
  @IsIn(['IN_PROGRESS', 'REALIZED'])
  action!: MeetingStatusAction;
}
