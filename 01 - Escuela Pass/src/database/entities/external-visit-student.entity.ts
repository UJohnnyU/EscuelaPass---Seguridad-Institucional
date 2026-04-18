import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'external_visit_students' })
export class ExternalVisitStudentEntity {
  @PrimaryColumn({ name: 'visit_id', type: 'uuid' })
  visitId!: string;

  @PrimaryColumn({ name: 'student_id', type: 'uuid' })
  studentId!: string;
}
