import type { CountsAs } from './entities/attendance.entities.js';

export interface AttendanceSummary {
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** Share of the sessions the student was expected at that they attended (late counts as attended). Null with none. */
  rate: number | null;
}

/** Excused sessions are left out of the rate: a student is not expected at them. */
export function summarize(statuses: CountsAs[]): AttendanceSummary {
  const count = (kind: CountsAs) =>
    statuses.filter((status) => status === kind).length;
  const summary = {
    sessions: statuses.length,
    present: count('present'),
    absent: count('absent'),
    late: count('late'),
    excused: count('excused'),
  };
  const expected = summary.sessions - summary.excused;
  return {
    ...summary,
    rate: expected > 0 ? (summary.present + summary.late) / expected : null,
  };
}

/** RFC 4180 CSV: fields with commas, quotes or line breaks are quoted. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (value: string | number | null) => {
    const text = value === null ? '' : String(value);
    // A leading = + - @ would run as a formula in spreadsheets.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
