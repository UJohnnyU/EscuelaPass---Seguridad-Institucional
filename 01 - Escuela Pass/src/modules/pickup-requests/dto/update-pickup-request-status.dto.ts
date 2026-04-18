import { IsIn } from 'class-validator';
import { PickupRequestStatus } from '../../../database/entities/pickup-request.entity';

export class UpdatePickupRequestStatusDto {
  @IsIn([
    PickupRequestStatus.APROBADA,
    PickupRequestStatus.RECHAZADA,
    PickupRequestStatus.COMPLETADA,
    PickupRequestStatus.CANCELADA
  ])
  status!: PickupRequestStatus;
}
