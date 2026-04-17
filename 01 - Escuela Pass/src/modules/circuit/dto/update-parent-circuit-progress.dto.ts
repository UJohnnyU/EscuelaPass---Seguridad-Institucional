import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CircuitStatus } from '../../../database/entities/circuit-request.entity';

/** Solo el padre puede avanzar estos estados (sin proximidad por GPS). */
const PARENT_NEXT = [CircuitStatus.PADRE_EN_CAMINO, CircuitStatus.NOTIFICADO_LLEGADA] as const;

export class UpdateParentCircuitProgressDto {
  @IsIn(PARENT_NEXT as unknown as string[])
  status!: (typeof PARENT_NEXT)[number];

  /** Obligatorio en servicio al pasar a NOTIFICADO_LLEGADA (ubicación en el momento de la acción). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  parentGpsLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  parentGpsLongitude?: number;
}
