import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from 'class-validator';
import { ExternalVisitAudienceScope } from '../../../database/entities/external-visit.entity';

export class CreateExternalVisitDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  purpose!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  visitorName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  visitorOrganization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsDateString()
  visitDatetime!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsEnum(ExternalVisitAudienceScope)
  audienceScope!: ExternalVisitAudienceScope;

  @ValidateIf((o: CreateExternalVisitDto) => o.audienceScope === ExternalVisitAudienceScope.GROUPS)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  groupIds?: string[];

  @ValidateIf(
    (o: CreateExternalVisitDto) => o.audienceScope === ExternalVisitAudienceScope.STUDENTS
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  studentIds?: string[];
}
