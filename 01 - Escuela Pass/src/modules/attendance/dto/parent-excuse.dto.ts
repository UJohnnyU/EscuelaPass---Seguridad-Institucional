import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ParentExcuseDto {
  @IsUUID('4')
  studentId!: string;

  /** Fecha del ausentismo (YYYY-MM-DD) */
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  date!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
