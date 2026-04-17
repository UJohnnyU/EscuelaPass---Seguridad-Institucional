import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class SaveActivityGradeEntryDto {
  @IsUUID()
  studentId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SaveActivityGradesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveActivityGradeEntryDto)
  entries!: SaveActivityGradeEntryDto[];
}
