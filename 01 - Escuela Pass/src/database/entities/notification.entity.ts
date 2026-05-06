import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'notice_id', type: 'uuid', nullable: true })
  noticeId!: string | null;

  /** Ruta SPA al abrir desde push (p. ej. /app/modulos/mis-calificaciones?activity=…). */
  @Column({ name: 'link_path', type: 'varchar', length: 480, nullable: true })
  linkPath!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;

  @Column({ name: 'delivery_status', type: 'varchar', length: 20, default: 'SENT' })
  deliveryStatus!: string;
}
