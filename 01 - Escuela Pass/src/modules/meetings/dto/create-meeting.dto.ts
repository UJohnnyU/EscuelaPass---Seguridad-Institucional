import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { MeetingModality } from '../../../database/entities/meeting.entity';

export class MeetingInviteDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsUUID('4')
  studentContextId?: string;
}

export class CreateMeetingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  purpose!: string;

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

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingInviteDto)
  invitees?: MeetingInviteDto[];

  @IsOptional()
  @IsBoolean()
  presetAllTeachersOfSchool?: boolean;

  @IsOptional()
  @IsBoolean()
  presetAllAdministrativesOfSchool?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  presetAllParentsOfGroupIds?: string[];
}
