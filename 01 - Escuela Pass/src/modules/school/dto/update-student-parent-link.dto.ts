import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentParentLinkDto {
  @IsString({ message: 'El parentesco debe ser texto.' })
  @MaxLength(50, { message: 'El parentesco no puede superar 50 caracteres.' })
  @IsOptional()
  relationship?: string;

  @IsBoolean({ message: 'Puede recoger debe ser verdadero o falso.' })
  @IsOptional()
  canPickup?: boolean;

  @IsBoolean({ message: 'Es vínculo principal debe ser verdadero o falso.' })
  @IsOptional()
  isPrimary?: boolean;
}
