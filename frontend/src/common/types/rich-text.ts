/** Tiptap JSON, as the API stores it after removing anything it doesn't allow. */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

export const isEmptyRichText = (doc: RichTextNode | null | undefined) =>
  !doc || !JSON.stringify(doc).includes('"text":');
