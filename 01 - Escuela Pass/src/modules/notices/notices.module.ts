import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminReportCommentEntity } from '../../database/entities/admin-report-comment.entity';
import { AdminReportEntity } from '../../database/entities/admin-report.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { NoticeEntity } from '../../database/entities/notice.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { NotificationsController } from './notifications.controller';
import { NoticesRemindersScheduler } from './notices-reminders.scheduler';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [
    AuthModule,
    FcmModule,
    TypeOrmModule.forFeature([
      NoticeEntity,
      NotificationEntity,
      AdminReportEntity,
      AdminReportCommentEntity,
      UserEntity,
      StudentEntity,
      TeacherEntity,
      GroupEntity
    ])
  ],
  controllers: [NoticesController, NotificationsController],
  providers: [NoticesService, NoticesRemindersScheduler],
  exports: [NoticesService]
})
export class NoticesModule {}
