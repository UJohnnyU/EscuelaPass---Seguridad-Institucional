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
