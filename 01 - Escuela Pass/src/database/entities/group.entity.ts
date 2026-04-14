import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ShiftType } from './shift-type.enum';

@Entity({ name: 'groups' })
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grade!: string | null;

  @Column({ type: 'enum', enum: ShiftType, default: ShiftType.MATUTINO })
  shift!: ShiftType;

  @Column({ name: 'school_year', type: 'varchar', length: 20 })
  schoolYear!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  classroom!: string | null;

  @Column({ type: 'int', nullable: true })
  capacity!: number | null;

  @Column({ type: 'boolean', default: true })
  status!: boolean;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
