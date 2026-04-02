import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateStudentDto {
  @IsUUID()
  @IsOptional()
  groupId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  matricula?: string;

  @IsBoolean()
  @IsOptional()
  canLeaveAlone?: boolean;
}
