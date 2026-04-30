import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminReportCommentDto {
  @IsString({ message: 'El mensaje debe ser texto.' })
  @MinLength(2, { message: 'El comentario debe tener al menos 2 caracteres.' })
  @MaxLength(2000, { message: 'El comentario no puede superar 2000 caracteres.' })
  message!: string;
}
