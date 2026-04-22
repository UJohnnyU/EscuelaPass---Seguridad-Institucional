import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminReportCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;
}
