import { Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';

/** HH:mm en 24 h */
const HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ShiftWindowPairDto {
  @Matches(HM_REGEX, { message: 'Use hora en formato HH:mm (24 h)' })
  start!: string;

  @Matches(HM_REGEX, { message: 'Use hora en formato HH:mm (24 h)' })
  end!: string;
}

export class SchoolShiftWindowsDto {
  @ValidateNested()
  @Type(() => ShiftWindowPairDto)
  matutino!: ShiftWindowPairDto;

  @ValidateNested()
  @Type(() => ShiftWindowPairDto)
  vespertino!: ShiftWindowPairDto;

  @ValidateNested()
  @Type(() => ShiftWindowPairDto)
  nocturno!: ShiftWindowPairDto;
}
