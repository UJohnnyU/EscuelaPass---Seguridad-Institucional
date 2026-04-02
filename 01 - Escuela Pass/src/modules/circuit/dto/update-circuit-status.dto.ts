import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CircuitStatus } from '../../../database/entities/circuit-request.entity';

export class UpdateCircuitStatusDto {
  @IsEnum(CircuitStatus)
  status!: CircuitStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

