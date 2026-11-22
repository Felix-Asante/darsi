import { parse } from 'csv-parse/sync';

export type CsvRow = Record<string, string>;

/** Header names are matched case-insensitively, with spaces and dashes read as underscores. */
const normalizeHeader = (header: string) =>
  header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const DELIMITERS = [',', ';', '\t'] as const;

/** Spreadsheets in French locales save CSV with `;`, so the header line decides the delimiter. */
function detectDelimiter(content: string) {
  const header = content.slice(0, content.search(/\r?\n|$/));
  const counts = DELIMITERS.map((delimiter) => header.split(delimiter).length);
  return DELIMITERS[counts.indexOf(Math.max(...counts))];
}

export function parseCsv(content: string): {
  headers: string[];
  rows: CsvRow[];
} {
  const records = parse(content, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    delimiter: detectDelimiter(content),
  }) as string[][];
  const [header = [], ...data] = records;
  const headers = header.map(normalizeHeader);
  return {
    headers,
    rows: data.map((cells) =>
      Object.fromEntries(
        headers.map((name, index) => [name, cells[index] ?? '']),
      ),
    ),
  };
}

/** `a; b ;c` → `['a', 'b', 'c']`, for cells holding several values. */
export const splitList = (cell: string | undefined) =>
  (cell ?? '')
    .split(/[;|]/)
    .map((value) => value.trim())
    .filter(Boolean);

export const optional = (cell: string | undefined) =>
  cell && cell.length > 0 ? cell : undefined;
