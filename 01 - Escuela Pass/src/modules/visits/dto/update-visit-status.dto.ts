import { IsIn } from 'class-validator';
import { VisitRequestStatus } from '../../../database/entities/visit-request.entity';

export class UpdateVisitStatusDto {
  @IsIn([
    VisitRequestStatus.APROBADA,
    VisitRequestStatus.RECHAZADA,
    VisitRequestStatus.REALIZADA,
    VisitRequestStatus.CANCELADA
  ])
  status!: VisitRequestStatus;
}
