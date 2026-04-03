import { IsBoolean } from 'class-validator';

export class UpdateCircuitSettingDto {
  @IsBoolean()
  enabled!: boolean;
}
