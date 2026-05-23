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

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { getAppTimeZone, todayInAppTimezone } from '../../common/local-date';
import { minutesSinceMidnightInTimeZone, parseTimeToMinutes } from '../../common/shift-schedule';
import { SchoolEntity } from '../../database/entities/school.entity';
import { ShiftType } from '../../database/entities/shift-type.enum';
import { AttendanceService } from './attendance.service';

export const ATTENDANCE_AUTO_CLOSE_NOTE =
  'Ausencia registrada automáticamente al cierre de jornada (sin registro previo de asistencia).';

@Injectable()
export class AttendanceShiftCloseService {
  private readonly logger = new Logger(AttendanceShiftCloseService.name);

  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    private readonly dataSource: DataSource,
    private readonly attendanceService: AttendanceService
  ) {}

  async runShiftClosures(): Promise<void> {
    const tz = getAppTimeZone();
    const todayYmd = todayInAppTimezone();
    const nowMin = minutesSinceMidnightInTimeZone(tz);

    const schools = await this.schoolsRepository.find({ where: { status: true } });

    for (const school of schools) {
      const checks: Array<{ shift: ShiftType; start: string | null; end: string | null }> = [
        { shift: ShiftType.MATUTINO, start: school.shiftMatutinoStart, end: school.shiftMatutinoEnd },
        { shift: ShiftType.VESPERTINO, start: school.shiftVespertinoStart, end: school.shiftVespertinoEnd },
        { shift: ShiftType.NOCTURNO, start: school.shiftNocturnoStart, end: school.shiftNocturnoEnd }
      ];

      for (const { shift, start, end } of checks) {
        if (!start || !end) continue;
        const endMin = parseTimeToMinutes(end);
        if (endMin === null) continue;
        if (nowMin < endMin) continue;

        const ids = await this.insertAutoAbsencesForShift(school.id, todayYmd, shift);
        if (ids.length > 0) {
          await this.attendanceService.applyUnjustifiedAbsentForRecordIds(ids);
          this.logger.log(
            `Cierre jornada ${shift}: escuela ${school.code ?? school.id} ${todayYmd} registros=${ids.length}`
          );
        }
      }
    }
  }

  private async insertAutoAbsencesForShift(
    schoolId: string,
    attendanceDate: string,
    shift: ShiftType
  ): Promise<string[]> {
    //! Fecha calendario en APP_TIMEZONE; DOW coincide con class_schedule_slots.weekday (0=domingo).
    const sql = `
INSERT INTO attendance_records (
  student_id,
  group_id,
  class_session_id,
  attendance_date,
  status,
  notes,
  registered_by
)
SELECT
  s.id,
  s.group_id,
  NULL,
  $1::date,
  'AUSENTE',
  $2,
  NULL
FROM students s
INNER JOIN groups g ON g.id = s.group_id
WHERE g.school_id = $3::uuid
  AND g.shift = $4::shift_type
  AND s.lifecycle_status = 'ACTIVO'
  AND s.group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.student_id = s.id AND ar.attendance_date = $1::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM school_non_instructional_days dni
    WHERE dni.exception_date = $1::date
      AND (dni.group_id = g.id OR (dni.group_id IS NULL AND dni.school_id = g.school_id))
  )
  AND EXISTS (
    SELECT 1 FROM class_schedule_slots css
    WHERE css.group_id = s.group_id
      AND css.weekday = EXTRACT(DOW FROM CAST($1 AS date))::integer
  )
RETURNING id
`;
    const rows = await this.dataSource.query<Array<{ id: string }>>(sql, [
      attendanceDate.slice(0, 10),
      ATTENDANCE_AUTO_CLOSE_NOTE,
      schoolId,
      shift
    ]);
    return rows.map((r) => r.id);
  }
}
