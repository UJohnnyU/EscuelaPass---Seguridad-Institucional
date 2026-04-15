import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { NoticeTargetType } from '../../../database/entities/notice.entity';
import { UserRole } from '../../../database/entities/user.entity';

export class CreateNoticeDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  content!: string;

  @IsEnum(NoticeTargetType)
  targetType!: NoticeTargetType;

  @IsUUID()
  @ValidateIf((o: CreateNoticeDto) => o.targetType === NoticeTargetType.USER)
  targetUserId?: string;

  @IsUUID()
  @ValidateIf((o: CreateNoticeDto) => o.targetType === NoticeTargetType.GROUP)
  targetGroupId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  @ValidateIf((o: CreateNoticeDto) => o.targetType === NoticeTargetType.ALL)
  targetRole?: UserRole;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isImportant?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
