import { checkUpload, contentDisposition, previewKind } from './file-rules.js';

describe('checkUpload', () => {
  it('accepts allowed types whose extension matches', () => {
    expect(
      checkUpload('Fiche de révision.pdf', 'application/pdf', 1024),
    ).toBeNull();
    expect(checkUpload('photo.JPG', 'image/jpeg', 1024)).toBeNull();
  });

  it.each([
    ['setup.exe', 'application/x-msdownload', 10, 'typeNotAllowed'],
    ['notes.pdf.exe', 'application/pdf', 10, 'extensionMismatch'],
    ['page.html', 'text/html', 10, 'typeNotAllowed'],
    ['empty.txt', 'text/plain', 0, 'empty'],
    ['huge.png', 'image/png', 26 * 1024 ** 2, 'tooLarge'],
    ['../../etc/passwd.txt', 'text/plain', 10, 'invalidName'],
    ['.hidden.txt', 'text/plain', 10, 'invalidName'],
  ])('refuses %s', (name, type, size, problem) => {
    expect(checkUpload(name, type, size)).toBe(problem);
  });
});

describe('previews and downloads', () => {
  it('knows what the browser can show', () => {
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('video/mp4')).toBe('video');
    expect(
      previewKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBeNull();
  });

  it('names downloads safely in any language', () => {
    expect(contentDisposition('Évaluation "finale".pdf', false)).toBe(
      `attachment; filename="Evaluation _finale_.pdf"; filename*=UTF-8''%C3%89valuation%20%22finale%22.pdf`,
    );
  });
});
