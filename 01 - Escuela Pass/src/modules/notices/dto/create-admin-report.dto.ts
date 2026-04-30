import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum AdminReportType {
  ERROR = 'ERROR',
  SUGERENCIA = 'SUGERENCIA',
  PETICION = 'PETICION',
  OTRO = 'OTRO'
}

export class CreateAdminReportDto {
  @IsEnum(AdminReportType, { message: 'Seleccione un tipo de reporte válido.' })
  type!: AdminReportType;

  @IsString({ message: 'El asunto debe ser texto.' })
  @MinLength(5, { message: 'El asunto debe tener al menos 5 caracteres.' })
  @MaxLength(160, { message: 'El asunto no puede superar 160 caracteres.' })
  subject!: string;

  @IsString({ message: 'El detalle debe ser texto.' })
  @MinLength(10, { message: 'El detalle debe tener al menos 10 caracteres.' })
  @MaxLength(4000, { message: 'El detalle no puede superar 4000 caracteres.' })
  message!: string;

  @IsOptional()
  @IsArray({ message: 'Las evidencias deben enviarse como una lista de enlaces.' })
  @IsString({ each: true, message: 'Cada evidencia debe ser un enlace de texto.' })
  @MaxLength(500, {
    each: true,
    message: 'Cada enlace de evidencia no puede superar 500 caracteres.'
  })
  evidenceUrls?: string[];
}
