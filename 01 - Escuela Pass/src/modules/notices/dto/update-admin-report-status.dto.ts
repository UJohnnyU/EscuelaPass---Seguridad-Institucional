import { IsEnum } from 'class-validator';
import { AdminReportStatus } from '../../../database/entities/admin-report.entity';

export class UpdateAdminReportStatusDto {
  @IsEnum(AdminReportStatus)
  status!: AdminReportStatus;
}
