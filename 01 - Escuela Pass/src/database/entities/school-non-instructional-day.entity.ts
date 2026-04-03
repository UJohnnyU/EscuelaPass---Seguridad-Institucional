import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'school_non_instructional_days' })
export class SchoolNonInstructionalDayEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'exception_date', type: 'date' })
  exceptionDate!: string;

  /** Null = toda la institución; si no, solo ese grupo. */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
