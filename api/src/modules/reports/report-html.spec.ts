import { renderReportHtml, type ReportDocument } from './report-html.js';

const report: ReportDocument = {
  locale: 'fr',
  schoolName: 'École du Lac',
  termName: 'Trimestre 1',
  termDates: { from: '2026-09-01', to: '2026-12-18' },
  student: { name: 'Amira Haddad', number: 'S-0001', grade: '5e' },
  entries: [
    {
      subject: 'Mathématiques',
      result: '15.5',
      scale: 'Note sur 20',
      comment: 'Très bon travail.\nContinuez.',
    },
    { subject: 'Sciences', result: null, scale: null, comment: null },
  ],
  attendance: { rate: 0.95, absent: 2, late: 1, sessions: 60 },
  generalComment: 'Un trimestre réussi.',
  issuedOn: '2026-12-19',
};

describe('renderReportHtml', () => {
  it('prints the report in the chosen language', () => {
    const html = renderReportHtml(report);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('Bulletin · Trimestre 1');
    expect(html).toContain('1 septembre 2026 – 18 décembre 2026');
    expect(html).toContain('Très bon travail.<br>Continuez.');
    expect(html.replace(/\s/g, ' ')).toContain('95 %');
    expect(renderReportHtml({ ...report, locale: 'en' })).toContain(
      'Progress report · Trimestre 1',
    );
  });

  it('escapes everything people typed', () => {
    const html = renderReportHtml({
      ...report,
      student: { ...report.student, name: '<script>alert(1)</script>' },
      generalComment: '"x" & <b>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;x&quot; &amp; &lt;b&gt;');
  });

  it('leaves out attendance and the general comment when the template does', () => {
    const html = renderReportHtml({
      ...report,
      attendance: null,
      generalComment: null,
    });
    expect(html).not.toContain('Assiduité');
    expect(html).not.toContain('Appréciation générale');
  });
});
