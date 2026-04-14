import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AttentionSeverity } from '../../../database/entities/student-attention-note.entity';

export class CreateAttentionNoteDto {
  @IsUUID()
  studentId!: string;

  @IsEnum(AttentionSeverity)
  severity!: AttentionSeverity;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(3000)
  description!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

