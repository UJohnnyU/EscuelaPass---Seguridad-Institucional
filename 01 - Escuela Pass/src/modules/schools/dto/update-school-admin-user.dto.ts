import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSchoolAdminUserDto {
  @ApiPropertyOptional({ example: 'María López R.' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  fullName?: string;

  /** Cadena vacía limpia el teléfono. Omitir para no modificarlo. */
  @ApiPropertyOptional({ example: '+52 555 987 6543', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Permite acceso físico al campus (lector, QR, etc.)' })
  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;

  @ApiPropertyOptional({ description: 'Cuenta activa; false impide el inicio de sesión' })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
