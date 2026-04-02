import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum NoticeTargetType {
  ALL = 'ALL',
  GROUP = 'GROUP',
  USER = 'USER'
}

@Entity({ name: 'notices' })
export class NoticeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'target_type', type: 'enum', enum: NoticeTargetType })
  targetType!: NoticeTargetType;

  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId!: string | null;

  @Column({ name: 'target_group_id', type: 'uuid', nullable: true })
  targetGroupId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'is_important', type: 'boolean', default: false })
  isImportant!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
