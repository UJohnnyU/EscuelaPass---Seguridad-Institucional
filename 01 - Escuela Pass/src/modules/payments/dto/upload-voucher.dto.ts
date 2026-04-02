import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadVoucherDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  voucherPath!: string;
}
