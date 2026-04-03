import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token!: string;

  /** Ej.: web, android, ios */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}
