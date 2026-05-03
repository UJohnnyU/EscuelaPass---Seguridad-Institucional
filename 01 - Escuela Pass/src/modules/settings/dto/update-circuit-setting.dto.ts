import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCircuitSettingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
