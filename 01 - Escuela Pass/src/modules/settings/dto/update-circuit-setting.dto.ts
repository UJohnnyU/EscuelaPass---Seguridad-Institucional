import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCircuitSettingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Exigir solicitud de retiro anticipado aprobada el mismo día para abrir circuito. */
  @IsOptional()
  @IsBoolean()
  requiresEarlyPickupApproval?: boolean;
}
