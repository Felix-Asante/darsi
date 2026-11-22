import type { ReactNode } from "react";
import { cn } from "@/common/lib/styles";
import type { RichTextNode } from "@/common/types/rich-text";

function marked(node: RichTextNode, key: number): ReactNode {
  return (node.marks ?? []).reduce<ReactNode>((children, mark) => {
    switch (mark.type) {
      case "bold":
        return <strong>{children}</strong>;
      case "italic":
        return <em>{children}</em>;
      case "underline":
        return <u>{children}</u>;
      case "strike":
        return <s>{children}</s>;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        return /^(https?:\/\/|mailto:)/i.test(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
            {children}
          </a>
        ) : (
          children
        );
      }
      default:
        return children;
    }
  }, <span key={key}>{node.text}</span>);
}

function render(node: RichTextNode, key: number): ReactNode {
  const children = node.content?.map(render);
  switch (node.type) {
    case "doc":
      return <>{children}</>;
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h4 key={key} className="font-semibold">
          {children}
        </h4>
      ) : (
        <h3 key={key} className="text-base font-semibold">
          {children}
        </h3>
      );
    case "bulletList":
      return (
        <ul key={key} className="list-disc ps-5">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal ps-5">
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-s-2 ps-3">
          {children}
        </blockquote>
      );
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return marked(node, key);
    default:
      return null;
  }
}

/** Renders stored rich text as elements, never as HTML, so nothing in it can run. */
export function RichTextView({ doc, className }: Readonly<{ doc: RichTextNode | null | undefined; className?: string }>) {
  if (!doc) return null;
  return <div className={cn("flex flex-col gap-2 text-sm leading-relaxed", className)}>{render(doc, 0)}</div>;
}
