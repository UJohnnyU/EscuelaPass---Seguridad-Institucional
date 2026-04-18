import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { ExternalVisitAudienceScope } from '../../../database/entities/external-visit.entity';

export class UpdateExternalVisitDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  visitorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  visitorOrganization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(ExternalVisitAudienceScope)
  audienceScope?: ExternalVisitAudienceScope;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}
