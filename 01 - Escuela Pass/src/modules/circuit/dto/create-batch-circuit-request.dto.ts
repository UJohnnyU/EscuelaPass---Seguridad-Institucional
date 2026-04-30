import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';
import { PickupMethod, PICKUP_METHOD_CREATE } from '../../../database/entities/circuit-request.entity';

export class CreateBatchCircuitRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsUUID()
  requestedByParentId!: string;

  @IsIn(PICKUP_METHOD_CREATE as unknown as string[])
  pickupMethod!: PickupMethod;

  @ValidateIf((o: CreateBatchCircuitRequestDto) => o.pickupMethod === PickupMethod.VEHICULO_REGISTRADO)
  @IsUUID()
  vehicleId?: string;

  @ValidateIf((o: CreateBatchCircuitRequestDto) => o.pickupMethod === PickupMethod.OTRO_VEHICULO)
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
