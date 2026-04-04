import { IsEnum, IsOptional } from 'class-validator';
import { TeacherCircuitSignal } from '../../../database/entities/circuit-request.entity';

export class UpdateTeacherCircuitSignalDto {
  /** Omitir para no cambiar; `null` limpia la señal. */
  @IsOptional()
  @IsEnum(TeacherCircuitSignal)
  signal?: TeacherCircuitSignal | null;
}
