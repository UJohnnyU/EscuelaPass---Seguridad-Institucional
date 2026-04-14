import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[A-Z0-9\-_]+$/, {
    message: 'code solo permite mayúsculas, números, guion y guion bajo'
  })
  code!: string;
}
