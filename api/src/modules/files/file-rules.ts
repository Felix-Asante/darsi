/**
 * What may be uploaded. Types are an allowlist checked against both the
 * declared content type and the file name's extension, so a renamed
 * executable is refused even before the malware scan.
 */
const TYPES: Record<string, { extensions: string[]; maxBytes: number }> = {
  'application/pdf': { extensions: ['pdf'], maxBytes: 100 * 1024 ** 2 },
  'image/png': { extensions: ['png'], maxBytes: 25 * 1024 ** 2 },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], maxBytes: 25 * 1024 ** 2 },
  'image/gif': { extensions: ['gif'], maxBytes: 25 * 1024 ** 2 },
  'image/webp': { extensions: ['webp'], maxBytes: 25 * 1024 ** 2 },
  'video/mp4': { extensions: ['mp4', 'm4v'], maxBytes: 1024 ** 3 },
  'video/webm': { extensions: ['webm'], maxBytes: 1024 ** 3 },
  'audio/mpeg': { extensions: ['mp3'], maxBytes: 200 * 1024 ** 2 },
  'audio/mp4': { extensions: ['m4a'], maxBytes: 200 * 1024 ** 2 },
  'text/plain': { extensions: ['txt'], maxBytes: 10 * 1024 ** 2 },
  'text/csv': { extensions: ['csv'], maxBytes: 10 * 1024 ** 2 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    maxBytes: 100 * 1024 ** 2,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['xlsx'],
    maxBytes: 100 * 1024 ** 2,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    extensions: ['pptx'],
    maxBytes: 200 * 1024 ** 2,
  },
  'application/msword': { extensions: ['doc'], maxBytes: 100 * 1024 ** 2 },
  'application/vnd.ms-excel': {
    extensions: ['xls'],
    maxBytes: 100 * 1024 ** 2,
  },
  'application/vnd.ms-powerpoint': {
    extensions: ['ppt'],
    maxBytes: 200 * 1024 ** 2,
  },
  'application/vnd.oasis.opendocument.text': {
    extensions: ['odt'],
    maxBytes: 100 * 1024 ** 2,
  },
  'application/vnd.oasis.opendocument.spreadsheet': {
    extensions: ['ods'],
    maxBytes: 100 * 1024 ** 2,
  },
  'application/vnd.oasis.opendocument.presentation': {
    extensions: ['odp'],
    maxBytes: 200 * 1024 ** 2,
  },
};

export type UploadProblem =
  'typeNotAllowed' | 'extensionMismatch' | 'tooLarge' | 'empty' | 'invalidName';

export function checkUpload(
  name: string,
  contentType: string,
  size: number,
): UploadProblem | null {
  const type = TYPES[contentType.toLowerCase()];
  if (!type) return 'typeNotAllowed';
  if (
    !/^[^/\\\0]{1,200}$/.test(name) ||
    name.trim() !== name ||
    name.startsWith('.')
  )
    return 'invalidName';
  const extension = name.includes('.')
    ? name.split('.').pop()!.toLowerCase()
    : '';
  if (!type.extensions.includes(extension)) return 'extensionMismatch';
  if (size <= 0) return 'empty';
  if (size > type.maxBytes) return 'tooLarge';
  return null;
}

/** How the browser can show the file without downloading it (DRV-6). */
export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | null;

export function previewKind(contentType: string): PreviewKind {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'text/plain' || contentType === 'text/csv') return 'text';
  return null;
}

/** RFC 6266 filename, ASCII fallback plus the UTF-8 name, for the download header. */
export function contentDisposition(name: string, inline: boolean): string {
  const ascii =
    name
      .normalize('NFD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '_') || 'file';
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
