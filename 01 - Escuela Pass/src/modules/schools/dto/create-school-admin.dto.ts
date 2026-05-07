import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolAdminDto {
  @ApiProperty({ example: 'admin.nuevo@escuela.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'María López' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ example: 'ClaveSegura1', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '+52 555 123 4567', maxLength: 30 })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Por defecto true si se omite', default: true })
  @IsBoolean()
  @IsOptional()
  canAccessCampus?: boolean;
}