"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { ItemKind } from "@/common/types/portfolio";
import { isEmptyRichText, type RichTextNode } from "@/common/types/rich-text";
import { FormAlert } from "@/components/form/form-alert";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const KINDS: ItemKind[] = ["text", "image", "document", "link"];

/** Adds work to a student's portfolio or a class portfolio (PRT-2/5). */
export function AddItemDialog({
  owner,
  showPendingNote,
}: Readonly<{ owner: { studentId: string } | { classId: string }; showPendingNote: boolean }>) {
  const t = useTranslations("portfolio");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ItemKind>("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState<RichTextNode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ready =
    title.trim() &&
    (kind === "text" ? !isEmptyRichText(body) : kind === "link" ? url.trim() : file !== null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const fileId = kind === "image" || kind === "document" ? (await api.files.upload(file!, { type: "portfolio", ...owner })).id : null;
      await api.portfolio.add({
        ...owner,
        kind,
        title: title.trim(),
        description: description.trim() || null,
        url: kind === "link" ? url.trim() : null,
        body: kind === "text" ? body : null,
        fileId,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      toast.success(t("form.added"));
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setKind("text");
          setTitle("");
          setDescription("");
          setUrl("");
          setBody(null);
          setFile(null);
          setTags("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon aria-hidden />
        {t("add")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            {showPendingNote && <DialogDescription>{t("form.pendingNote")}</DialogDescription>}
          </DialogHeader>
          <FormAlert message={error} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("form.kind")}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {KINDS.map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" name="item-kind" checked={kind === option} onChange={() => setKind(option)} />
                  {t(`kinds.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-title">{t("form.name")}</Label>
            <Input id="item-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          {kind === "text" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-body">{t("form.body")}</Label>
              <RichTextEditor id="item-body" label={t("form.body")} value={body} onChange={setBody} />
            </div>
          )}
          {kind === "link" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-url">{t("form.url")}</Label>
              <Input id="item-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />
            </div>
          )}
          {(kind === "image" || kind === "document") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-file">{t("form.file")}</Label>
              <Input
                id="item-file"
                type="file"
                accept={kind === "image" ? "image/png,image/jpeg,image/gif,image/webp" : undefined}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-description">{`${t("form.description")} (${tCommon("optional")})`}</Label>
            <Textarea id="item-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-tags">{`${t("form.tags")} (${tCommon("optional")})`}</Label>
            <Input id="item-tags" aria-describedby="item-tags-hint" value={tags} onChange={(event) => setTags(event.target.value)} />
            <p id="item-tags-hint" className="text-muted-foreground text-xs">
              {t("form.tagsHint")}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
