import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentAttentionNoteEntity } from '../../database/entities/student-attention-note.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { AttentionNotesController } from './attention-notes.controller';
import { AttentionNotesService } from './attention-notes.service';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [
    AuthModule,
    FcmModule,
    TypeOrmModule.forFeature([
      StudentAttentionNoteEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity,
      NotificationEntity
    ])
  ],
  controllers: [AttentionNotesController],
  providers: [AttentionNotesService]
})
export class AttentionNotesModule {}

