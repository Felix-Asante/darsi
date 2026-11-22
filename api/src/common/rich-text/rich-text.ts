/**
 * Rich text is stored as Tiptap (ProseMirror) JSON and rendered by the app as
 * nodes, never as HTML. Only the nodes, marks and attributes below are kept, so
 * a crafted document can't smuggle scripts, styles or `javascript:` links.
 */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

const NODES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
]);
const MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'link']);
const MAX_DEPTH = 12;
const MAX_TEXT = 50_000;

export class RichTextError extends Error {}

const safeHref = (href: unknown) =>
  typeof href === 'string' &&
  /^(https?:\/\/|mailto:)/i.test(href.trim()) &&
  href.length <= 2000
    ? href.trim()
    : null;

function clean(
  node: unknown,
  depth: number,
  budget: { text: number },
): RichTextNode | null {
  if (depth > MAX_DEPTH) throw new RichTextError('tooDeep');
  if (typeof node !== 'object' || node === null) return null;
  const { type, text, attrs, marks, content } = node as RichTextNode;
  if (typeof type !== 'string' || !NODES.has(type)) return null;

  if (type === 'text') {
    if (typeof text !== 'string' || text.length === 0) return null;
    budget.text += text.length;
    if (budget.text > MAX_TEXT) throw new RichTextError('tooLong');
    const kept = (Array.isArray(marks) ? marks : []).flatMap((mark) => {
      if (!MARKS.has(mark?.type)) return [];
      if (mark.type !== 'link') return [{ type: mark.type }];
      const href = safeHref(mark.attrs?.href);
      return href ? [{ type: 'link', attrs: { href } }] : [];
    });
    return kept.length > 0 ? { type, text, marks: kept } : { type, text };
  }

  const result: RichTextNode = { type };
  if (type === 'heading') {
    const level = Number(attrs?.level);
    result.attrs = { level: level === 3 ? 3 : 2 };
  }
  if (type === 'orderedList' && Number.isInteger(attrs?.start))
    result.attrs = { start: attrs!.start };
  if (Array.isArray(content)) {
    const children = content
      .map((child) => clean(child, depth + 1, budget))
      .filter((child) => child !== null);
    if (children.length > 0) result.content = children;
  }
  return result;
}

/** Keeps what's allowed; throws when the document is not a document or too large. */
export function sanitizeRichText(input: unknown): RichTextNode {
  const doc = clean(input, 0, { text: 0 });
  if (!doc || doc.type !== 'doc') throw new RichTextError('notADocument');
  return doc;
}

/** The text alone, blocks separated by spaces: for excerpts in mail and notices. */
export function plainText(
  node: RichTextNode | null | undefined,
  limit = 300,
): string {
  const parts: string[] = [];
  const walk = (current: RichTextNode) => {
    if (current.text) parts.push(current.text);
    current.content?.forEach(walk);
    if (current.type !== 'text' && current.type !== 'doc') parts.push(' ');
  };
  if (node) walk(node);
  const text = parts.join('').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}
