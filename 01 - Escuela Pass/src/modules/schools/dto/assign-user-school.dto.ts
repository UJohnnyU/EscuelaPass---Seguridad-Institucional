import { IsUUID } from 'class-validator';

export class AssignUserSchoolDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  schoolId!: string;
}
