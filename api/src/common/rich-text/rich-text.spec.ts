import { plainText, RichTextError, sanitizeRichText } from './rich-text.js';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });

describe('sanitizeRichText', () => {
  it('keeps allowed nodes and marks', () => {
    const input = doc(
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Trip' }],
      },
      paragraph(
        { type: 'text', text: 'Bring', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' lunch' },
      ),
    );
    expect(sanitizeRichText(input)).toEqual(input);
  });

  it('drops unknown nodes, attributes and unsafe links', () => {
    const input = doc(
      { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
      paragraph(
        {
          type: 'text',
          text: 'click',
          marks: [
            {
              type: 'link',
              attrs: { href: 'javascript:alert(1)', onclick: 'x' },
            },
          ],
        },
        {
          type: 'text',
          text: 'safe',
          marks: [
            {
              type: 'link',
              attrs: { href: 'https://example.org', target: '_blank' },
            },
            { type: 'style' },
          ],
        },
      ),
      {
        type: 'paragraph',
        attrs: { style: 'color:red' },
        content: [{ type: 'text', text: 'x' }],
      },
    );
    expect(sanitizeRichText(input)).toEqual(
      doc(
        paragraph(
          { type: 'text', text: 'click' },
          {
            type: 'text',
            text: 'safe',
            marks: [{ type: 'link', attrs: { href: 'https://example.org' } }],
          },
        ),
        paragraph({ type: 'text', text: 'x' }),
      ),
    );
  });

  it('refuses non-documents, deep nesting and huge texts', () => {
    expect(() => sanitizeRichText({ type: 'paragraph' })).toThrow(
      RichTextError,
    );
    expect(() => sanitizeRichText('<p>hi</p>')).toThrow(RichTextError);
    let deep: unknown = { type: 'text', text: 'x' };
    for (let index = 0; index < 20; index += 1)
      deep = { type: 'blockquote', content: [deep] };
    expect(() => sanitizeRichText(doc(deep))).toThrow('tooDeep');
    expect(() =>
      sanitizeRichText(
        doc(paragraph({ type: 'text', text: 'a'.repeat(60_000) })),
      ),
    ).toThrow('tooLong');
  });
});

describe('plainText', () => {
  it('reads blocks as text and shortens it', () => {
    const input = sanitizeRichText(
      doc(
        paragraph({ type: 'text', text: 'Hello' }),
        paragraph({ type: 'text', text: 'world' }),
      ),
    );
    expect(plainText(input)).toBe('Hello world');
    expect(plainText(input, 8)).toBe('Hello w…');
  });
});
