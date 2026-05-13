import { IsEnum, IsString } from 'class-validator';
import { AccessEventType, AccessMethod } from '../../../database/entities/access-event.entity';

export class RegisterAccessEventDto {
  @IsEnum(AccessMethod)
  method!: AccessMethod;

  @IsString()
  credentialValue!: string;

  @IsEnum(AccessEventType)
  eventType!: AccessEventType;
}
