import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'import_jobs' })
export class ImportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  kind!: 'groups' | 'students' | 'teachers' | 'teacher-assignments' | 'students-to-groups-xlsx';

  @Column({ name: 'total_rows', type: 'int' })
  totalRows!: number;

  @Column({ name: 'created_count', type: 'int' })
  createdCount!: number;

  @Column({ name: 'error_count', type: 'int' })
  errorCount!: number;

  @Column({ name: 'dry_run', type: 'boolean', default: false })
  dryRun!: boolean;

  @Column({ name: 'errors_json', type: 'jsonb', nullable: true })
  errorsJson!: Array<{ row: number; message: string }> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
