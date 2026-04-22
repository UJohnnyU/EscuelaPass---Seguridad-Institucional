import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectVoucherDto {
  @IsString()
  @MinLength(5, { message: 'Indique un motivo de al menos 5 caracteres.' })
  @MaxLength(2000)
  reason!: string;
}
