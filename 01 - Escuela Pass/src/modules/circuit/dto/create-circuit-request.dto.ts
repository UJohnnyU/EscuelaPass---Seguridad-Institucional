import { IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PickupMethod } from '../../../database/entities/circuit-request.entity';

export class CreateCircuitRequestDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  requestedByParentId!: string;

  @IsEnum(PickupMethod)
  pickupMethod!: PickupMethod;

  @IsUUID()
  @IsOptional()
  pickupAuthorizationId?: string;

  @IsUUID()
  @IsOptional()
  departureConsentId?: string;

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
