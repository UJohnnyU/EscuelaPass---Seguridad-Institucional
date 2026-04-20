import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SetDepartureConsentDto {
  @IsUUID('4')
  studentId!: string;

  /** Si es true, activa salida autónoma para el día indicado; si false, la desactiva. */
  @IsBoolean()
  active!: boolean;

  /** ISO fecha (YYYY-MM-DD). Por defecto hoy (zona servidor). */
  @IsOptional()
  date?: string;
}
