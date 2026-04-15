import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ShiftType } from '../../../database/entities/shift-type.enum';

export class CreateGroupDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  grade?: string;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;

  @IsString()
  @MaxLength(20)
  schoolYear!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  classroom?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  /** Obligatorio para ADMIN de plataforma sin escuela en el token. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}
