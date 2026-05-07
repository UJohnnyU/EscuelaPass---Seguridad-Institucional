import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CircuitStatus } from '../../../database/entities/circuit-request.entity';

/**
 * `PADRE_EN_CAMINO`: transición desde pendiente / actualización opcional solo-GPS cuando ya está en camino.
 * `NOTIFICADO_LLEGADA`: valor legacy compat; el backend delega en la misma lógica que `PATCH .../gps`
 * cuando vienen coordenadas (clients viejos o E2E). Sin GPS debe rechazarse.
 */
const PARENT_PROGRESS_STATUS = [
  CircuitStatus.PADRE_EN_CAMINO,
  CircuitStatus.NOTIFICADO_LLEGADA
] as const;

export class UpdateParentCircuitProgressDto {
  @IsIn(PARENT_PROGRESS_STATUS as unknown as string[])
  status!: (typeof PARENT_PROGRESS_STATUS)[number];

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
