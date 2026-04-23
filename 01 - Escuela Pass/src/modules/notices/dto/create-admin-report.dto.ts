import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum AdminReportType {
  ERROR = 'ERROR',
  SUGERENCIA = 'SUGERENCIA',
  PETICION = 'PETICION',
  OTRO = 'OTRO'
}

export class CreateAdminReportDto {
  @IsEnum(AdminReportType)
  type!: AdminReportType;

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidenceUrls?: string[];
}
