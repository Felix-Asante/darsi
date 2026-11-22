"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BoldIcon, Heading2Icon, ItalicIcon, ListIcon, ListOrderedIcon, QuoteIcon, UnderlineIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/common/lib/styles";
import type { RichTextNode } from "@/common/types/rich-text";
import { Toggle } from "./toggle";

interface RichTextEditorProps {
  id: string;
  label: string;
  value: RichTextNode | null;
  onChange: (doc: RichTextNode) => void;
  invalid?: boolean;
  describedBy?: string;
  minHeight?: "sm" | "md";
}

/** Only what the API keeps: paragraphs, two heading levels, lists, quotes, basic marks and links. */
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: { openOnClick: false, autolink: true, protocols: ["https", "mailto"] },
  }),
];

export function RichTextEditor({ id, label, value, onChange, invalid, describedBy, minHeight = "md" }: Readonly<RichTextEditorProps>) {
  const t = useTranslations("common.richText");
  const editor = useEditor({
    extensions,
    content: value ?? undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: cn(
          "prose-sm max-w-none px-3 py-2 text-sm outline-none [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_p]:my-1 [&_a]:text-primary [&_a]:underline",
          minHeight === "md" ? "min-h-32" : "min-h-20",
        ),
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextNode),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      heading: current?.isActive("heading", { level: 2 }) ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
    }),
  });
  const chain = () => editor?.chain().focus();

  return (
    <div
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 rounded-md border focus-within:ring-3",
        invalid && "border-destructive",
      )}
    >
      <div role="toolbar" aria-label={t("toolbar", { field: label })} className="flex flex-wrap gap-0.5 border-b p-1">
        <Toggle label={t("bold")} pressed={state?.bold} onClick={() => chain()?.toggleBold().run()}>
          <BoldIcon aria-hidden />
        </Toggle>
        <Toggle label={t("italic")} pressed={state?.italic} onClick={() => chain()?.toggleItalic().run()}>
          <ItalicIcon aria-hidden />
        </Toggle>
        <Toggle label={t("underline")} pressed={state?.underline} onClick={() => chain()?.toggleUnderline().run()}>
          <UnderlineIcon aria-hidden />
        </Toggle>
        <Toggle label={t("heading")} pressed={state?.heading} onClick={() => chain()?.toggleHeading({ level: 2 }).run()}>
          <Heading2Icon aria-hidden />
        </Toggle>
        <Toggle label={t("bulletList")} pressed={state?.bulletList} onClick={() => chain()?.toggleBulletList().run()}>
          <ListIcon aria-hidden />
        </Toggle>
        <Toggle label={t("orderedList")} pressed={state?.orderedList} onClick={() => chain()?.toggleOrderedList().run()}>
          <ListOrderedIcon aria-hidden />
        </Toggle>
        <Toggle label={t("quote")} pressed={state?.blockquote} onClick={() => chain()?.toggleBlockquote().run()}>
          <QuoteIcon aria-hidden />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
