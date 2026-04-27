import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PickupMethod, PICKUP_METHOD_CREATE } from '../../../database/entities/circuit-request.entity';

export class CreateCircuitRequestDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  requestedByParentId!: string;

  @IsIn(PICKUP_METHOD_CREATE as unknown as string[])
  pickupMethod!: PickupMethod;

  @IsUUID()
  @IsOptional()
  pickupAuthorizationId?: string;

  @IsUUID()
  @IsOptional()
  departureConsentId?: string;

  /** Obligatorio si pickupMethod es VEHICULO_REGISTRADO (vehículo dado de alta del padre). */
  @ValidateIf((o: CreateCircuitRequestDto) => o.pickupMethod === PickupMethod.VEHICULO_REGISTRADO)
  @IsUUID()
  vehicleId?: string;

  /** Requerido cuando el padre llega en taxi o auto no registrado. */
  @ValidateIf((o: CreateCircuitRequestDto) => o.pickupMethod === PickupMethod.OTRO_VEHICULO)
  @IsString()
  @MaxLength(120)
  pickupVehicleDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  pickupNotes?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  parentGpsLatitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  parentGpsLongitude?: number;
}
