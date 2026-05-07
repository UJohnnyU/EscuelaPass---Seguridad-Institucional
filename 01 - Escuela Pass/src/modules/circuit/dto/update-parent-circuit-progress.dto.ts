import { IsIn } from 'class-validator';
import { CircuitStatus } from '../../../database/entities/circuit-request.entity';

/**
 * Solo el padre puede avanzar a PADRE_EN_CAMINO.
 * NOTIFICADO_LLEGADA ya no se controla manualmente: se activa de forma automática
 * cuando el GPS del padre entra al radio de la escuela (via PATCH .../gps).
 */
const PARENT_NEXT = [CircuitStatus.PADRE_EN_CAMINO] as const;

export class UpdateParentCircuitProgressDto {
  @IsIn(PARENT_NEXT as unknown as string[])
  status!: (typeof PARENT_NEXT)[number];
}
