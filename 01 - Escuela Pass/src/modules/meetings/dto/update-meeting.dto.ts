import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { MeetingModality } from '../../../database/entities/meeting.entity';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  purpose?: string;

  @IsOptional()
  @IsEnum(MeetingModality)
  modality?: MeetingModality;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingLink?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;
}
