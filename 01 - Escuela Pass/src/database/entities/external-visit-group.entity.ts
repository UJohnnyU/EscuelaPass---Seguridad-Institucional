import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'external_visit_groups' })
export class ExternalVisitGroupEntity {
  @PrimaryColumn({ name: 'visit_id', type: 'uuid' })
  visitId!: string;

  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId!: string;
}
