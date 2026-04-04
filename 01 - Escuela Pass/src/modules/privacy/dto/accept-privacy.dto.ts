import { IsString, Length } from 'class-validator';

export class AcceptPrivacyDto {
  @IsString()
  @Length(1, 32)
  version!: string;
}
