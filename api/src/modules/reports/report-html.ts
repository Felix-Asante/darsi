/** Everything printed on a report, already resolved; no lookups happen while rendering. */
export interface ReportDocument {
  locale: 'en' | 'fr';
  schoolName: string;
  termName: string;
  termDates: { from: string; to: string };
  student: { name: string; number: string; grade: string | null };
  entries: {
    subject: string;
    result: string | null;
    scale: string | null;
    comment: string | null;
  }[];
  attendance: {
    rate: number | null;
    absent: number;
    late: number;
    sessions: number;
  } | null;
  generalComment: string | null;
  issuedOn: string;
}

const COPY = {
  en: {
    title: 'Progress report',
    student: 'Student',
    number: 'Student no.',
    grade: 'Grade',
    subject: 'Subject',
    result: 'Result',
    comment: 'Comment',
    attendance: 'Attendance',
    rate: 'Attendance rate',
    absences: 'Absences',
    lates: 'Lates',
    sessions: 'Sessions',
    general: 'General comment',
    issued: 'Issued on',
    noResult: '—',
  },
  fr: {
    title: 'Bulletin',
    student: 'Élève',
    number: 'N° d’élève',
    grade: 'Niveau',
    subject: 'Matière',
    result: 'Résultat',
    comment: 'Appréciation',
    attendance: 'Assiduité',
    rate: 'Taux de présence',
    absences: 'Absences',
    lates: 'Retards',
    sessions: 'Séances',
    general: 'Appréciation générale',
    issued: 'Édité le',
    noResult: '—',
  },
} as const;

/** Every value goes through this: names and comments are typed by people. */
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

const date = (value: string, locale: 'en' | 'fr') =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

/** A self-contained, print-ready HTML page for Gotenberg to turn into a PDF. */
export function renderReportHtml(report: ReportDocument): string {
  const t = COPY[report.locale];
  const text = (value: string | null) => (value ? escapeHtml(value) : '');
  const percent = (value: number | null) =>
    value === null
      ? t.noResult
      : new Intl.NumberFormat(report.locale, {
          style: 'percent',
          maximumFractionDigits: 0,
        }).format(value);
  const rows = report.entries
    .map(
      (entry) => `<tr>
        <td class="subject">${text(entry.subject)}</td>
        <td class="result">${entry.result ? `${text(entry.result)}${entry.scale ? `<span class="scale">${text(entry.scale)}</span>` : ''}` : t.noResult}</td>
        <td>${text(entry.comment).replace(/\n/g, '<br>')}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${report.locale}">
<head>
<meta charset="utf-8">
<title>${t.title} – ${text(report.student.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; color: #1c2333; font-size: 10.5pt; line-height: 1.45; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1f4b99; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 18pt; margin: 0; color: #1f4b99; }
  .school { font-weight: 600; }
  dl { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 4px 12px; margin: 0 0 16px; }
  dt { color: #5b6475; }
  dd { margin: 0; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 9pt; color: #5b6475; border-bottom: 1px solid #c9c4ba; padding: 6px 8px; }
  td { vertical-align: top; border-bottom: 1px solid #e5e2dc; padding: 8px; }
  tr { break-inside: avoid; }
  .subject { font-weight: 600; width: 22%; }
  .result { width: 16%; font-variant-numeric: tabular-nums; font-weight: 600; }
  .scale { display: block; font-weight: 400; color: #5b6475; font-size: 8.5pt; }
  h2 { font-size: 11pt; margin: 18px 0 6px; }
  .general { white-space: pre-line; }
  footer { margin-top: 24px; color: #5b6475; font-size: 9pt; }
</style>
</head>
<body>
<header>
  <h1>${t.title} · ${text(report.termName)}</h1>
  <span class="school">${text(report.schoolName)}</span>
</header>
<dl>
  <dt>${t.student}</dt><dd>${text(report.student.name)}</dd>
  <dt>${t.number}</dt><dd>${text(report.student.number)}</dd>
  <dt>${t.grade}</dt><dd>${text(report.student.grade) || t.noResult}</dd>
  <dt></dt><dd>${date(report.termDates.from, report.locale)} – ${date(report.termDates.to, report.locale)}</dd>
</dl>
<table>
  <thead><tr><th>${t.subject}</th><th>${t.result}</th><th>${t.comment}</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
${
  report.attendance
    ? `<h2>${t.attendance}</h2>
<dl>
  <dt>${t.rate}</dt><dd>${percent(report.attendance.rate)}</dd>
  <dt>${t.sessions}</dt><dd>${report.attendance.sessions}</dd>
  <dt>${t.absences}</dt><dd>${report.attendance.absent}</dd>
  <dt>${t.lates}</dt><dd>${report.attendance.late}</dd>
</dl>`
    : ''
}
${report.generalComment ? `<h2>${t.general}</h2><p class="general">${text(report.generalComment)}</p>` : ''}
<footer>${t.issued} ${date(report.issuedOn, report.locale)}</footer>
</body>
</html>`;
}
