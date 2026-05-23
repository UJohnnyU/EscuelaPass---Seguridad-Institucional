/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'schools' })
export class SchoolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  code!: string;

  @Column({ type: 'boolean', default: true })
  status!: boolean;

  /** Estado del circuito por institución (independiente de otras escuelas). */
  @Column({ name: 'circuit_enabled', type: 'boolean', default: true })
  circuitEnabled!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  phone!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: false })
  latitude!: string;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: false })
  longitude!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ name: 'director_name', type: 'varchar', length: 200, nullable: true })
  directorName!: string | null;

  @Column({ name: 'student_matricula_prefix', type: 'varchar', length: 20, nullable: true })
  studentMatriculaPrefix!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  motto!: string | null;

  /** Escala institucional para calificar actividades (0..max), con 2 decimales. */
  @Column({ name: 'max_grade_scale', type: 'decimal', precision: 5, scale: 2, default: 100 })
  maxGradeScale!: string;

  /** Nota minima aprobatoria (0..max_grade_scale). */
  @Column({ name: 'passing_grade', type: 'decimal', precision: 5, scale: 2, default: 0 })
  passingGrade!: string;

  /** Minimo de materias reprobadas en el boletin final para marcar REPROBADO. */
  @Column({ name: 'min_failed_subjects_to_repeat', type: 'int', default: 3 })
  minFailedSubjectsToRepeat!: number;

  /** Inicio de clases jornada matutina (hora local institucional, cf. APP_TIMEZONE). */
  @Column({ name: 'shift_matutino_start', type: 'time', nullable: true })
  shiftMatutinoStart!: string | null;

  /** Fin de clases jornada matutina. */
  @Column({ name: 'shift_matutino_end', type: 'time', nullable: true })
  shiftMatutinoEnd!: string | null;

  @Column({ name: 'shift_vespertino_start', type: 'time', nullable: true })
  shiftVespertinoStart!: string | null;

  @Column({ name: 'shift_vespertino_end', type: 'time', nullable: true })
  shiftVespertinoEnd!: string | null;

  @Column({ name: 'shift_nocturno_start', type: 'time', nullable: true })
  shiftNocturnoStart!: string | null;

  @Column({ name: 'shift_nocturno_end', type: 'time', nullable: true })
  shiftNocturnoEnd!: string | null;

  /** Ruta pública bajo `/uploads/school-logos/…` */
  @Column({ name: 'logo_path', type: 'varchar', length: 500, nullable: true })
  logoPath!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
