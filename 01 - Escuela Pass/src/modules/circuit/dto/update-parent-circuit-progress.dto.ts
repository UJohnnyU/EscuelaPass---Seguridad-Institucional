import { IsIn } from 'class-validator';
import { CircuitStatus } from '../../../database/entities/circuit-request.entity';

/** Solo el padre puede avanzar estos estados (sin proximidad por GPS). */
const PARENT_NEXT = [CircuitStatus.PADRE_EN_CAMINO, CircuitStatus.NOTIFICADO_LLEGADA] as const;

export class UpdateParentCircuitProgressDto {
  @IsIn(PARENT_NEXT as unknown as string[])
  status!: (typeof PARENT_NEXT)[number];
}
