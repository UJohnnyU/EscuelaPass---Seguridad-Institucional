import {
  minutesSinceMidnightInTimeZone,
  parseTimeToMinutes,
  timeHmToSql
} from './shift-schedule';

describe('shift-schedule', () => {
  test('timeHmToSql', () => {
    expect(timeHmToSql('08:30')).toBe('08:30:00');
    expect(timeHmToSql('08:30:00')).toBe('08:30:00');
  });

  test('parseTimeToMinutes', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('13:45')).toBe(13 * 60 + 45);
    expect(parseTimeToMinutes('13:45:00')).toBe(13 * 60 + 45);
    expect(parseTimeToMinutes(null)).toBeNull();
  });

  test('minutesSinceMidnightInTimeZone returns value in day range', () => {
    const m = minutesSinceMidnightInTimeZone('UTC', new Date('2026-06-15T12:30:00.000Z'));
    expect(m).toBe(12 * 60 + 30);
  });
});
