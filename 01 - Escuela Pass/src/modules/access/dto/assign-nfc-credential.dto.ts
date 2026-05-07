import { IsString, IsUUID, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignNfcCredentialDto {
  @ApiProperty({ description: 'UUID del usuario al que se asigna la credencial NFC' })
  @IsUUID('4')
  targetUserId!: string;

  @ApiProperty({ description: 'UID del tag NFC (hexadecimal, 4–14 bytes = 8–28 chars)' })
  @IsString()
  @Length(4, 40)
  @Matches(/^[0-9A-Fa-f:]+$/, { message: 'nfcUid debe contener solo caracteres hexadecimales' })
  nfcUid!: string;
}
