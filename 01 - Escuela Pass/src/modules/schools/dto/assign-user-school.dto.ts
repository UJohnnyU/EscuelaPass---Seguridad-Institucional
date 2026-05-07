import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignUserSchoolDto {
  @ApiProperty({ format: 'uuid', description: 'Usuario a vincular' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid', description: 'Escuela destino' })
  @IsUUID()
  schoolId!: string;
}
