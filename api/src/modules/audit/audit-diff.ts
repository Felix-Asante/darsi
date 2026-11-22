import { isDeepStrictEqual } from 'node:util';
import type { AuditDiff } from './audit-event.entity.js';

type Snapshot = Record<string, unknown> | null | undefined;

const IGNORED_FIELDS = new Set(['updatedAt', 'version']);

/** Keeps only the fields that changed, so the log stays small and holds no untouched personal data. */
export function diffSnapshots(
  before: Snapshot,
  after: Snapshot,
): AuditDiff | null {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const diff: AuditDiff = {};

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const previous = before?.[key];
    const next = after?.[key];
    if (!isDeepStrictEqual(previous, next)) {
      diff[key] = { before: previous ?? null, after: next ?? null };
    }
  }

  return Object.keys(diff).length ? diff : null;
}
