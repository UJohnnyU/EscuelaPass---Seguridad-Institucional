import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class LinkParentStudentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  parentId!: string;

  @IsString()
  @MaxLength(50)
  relationship!: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsBoolean()
  @IsOptional()
  canPickup?: boolean;

  /** Para ADMIN de plataforma: misma escuela que estudiante y padre. */
  @IsUUID()
  @IsOptional()
  schoolId?: string;
}
