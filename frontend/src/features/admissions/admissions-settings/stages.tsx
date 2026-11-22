"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getStagesQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import {
  STAGE_KINDS,
  type Stage,
  type StageKind,
} from "@/common/types/admissions";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Choice } from "./choice";
import { Section } from "./section";

interface Draft {
  key: string;
  id?: string;
  name: string;
  kind: StageKind;
  emailOn: boolean;
  enSubject: string;
  enBody: string;
  frSubject: string;
  frBody: string;
}

const toDraft = (stage: Stage): Draft => ({
  key: stage.id,
  id: stage.id,
  name: stage.name,
  kind: stage.kind,
  emailOn: stage.email !== null,
  enSubject: stage.email?.en.subject ?? "",
  enBody: stage.email?.en.body ?? "",
  frSubject: stage.email?.fr?.subject ?? "",
  frBody: stage.email?.fr?.body ?? "",
});

/** The school's pipeline and the email each stage sends to the family (ADMS-5, ADMS-8). */
export function Stages() {
  const t = useTranslations("admissions.stages");
  const stages = useQuery(getStagesQueryOptions());
  return (
    <Section id="stages" title={t("title")} description={t("description")}>
      {stages.data ? (
        <Editor key={stages.dataUpdatedAt} initial={stages.data} />
      ) : (
        <Skeleton className="h-48 w-full" />
      )}
    </Section>
  );
}

function Editor({ initial }: Readonly<{ initial: Stage[] }>) {
  const t = useTranslations("admissions.stages");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [drafts, setDrafts] = useState(() => initial.map(toDraft));
  const [invalid, setInvalid] = useState(false);
  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    );
  const shift = (index: number, by: number) =>
    setDrafts((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(index + by, 0, moved);
      return next;
    });

  const save = useMutation({
    mutationFn: async () => {
      if (
        drafts.some(
          (draft) =>
            !draft.name.trim() ||
            (draft.emailOn &&
              (!draft.enSubject.trim() || !draft.enBody.trim())),
        )
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.admissions.saveStages(
        drafts.map((draft) => ({
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name.trim(),
          kind: draft.kind,
          email: draft.emailOn
            ? {
                en: {
                  subject: draft.enSubject.trim(),
                  body: draft.enBody.trim(),
                },
                ...(draft.frSubject.trim() && draft.frBody.trim()
                  ? {
                      fr: {
                        subject: draft.frSubject.trim(),
                        body: draft.frBody.trim(),
                      },
                    }
                  : {}),
              }
            : null,
        })),
      );
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("saved"));
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all(),
      });
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <FormAlert
        message={
          invalid ? t("invalid") : save.error ? errorMessage(save.error) : null
        }
      />
      <p className="text-muted-foreground text-xs">{t("placeholders")}</p>
      <ol className="flex flex-col gap-2">
        {drafts.map((draft, index) => (
          <li
            key={draft.key}
            className="bg-card flex flex-col gap-3 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor={`stage-${draft.key}-name`}>{t("name")}</Label>
                <Input
                  id={`stage-${draft.key}-name`}
                  value={draft.name}
                  onChange={(event) =>
                    update(draft.key, { name: event.target.value })
                  }
                />
              </div>
              <Choice
                id={`stage-${draft.key}-kind`}
                label={t("kind")}
                className="sm:w-48"
                value={draft.kind}
                onChange={(kind) => update(draft.key, { kind })}
                items={STAGE_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`kinds.${kind}`),
                }))}
              />
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id={`stage-${draft.key}-email`}
                  checked={draft.emailOn}
                  onCheckedChange={(checked) =>
                    update(draft.key, { emailOn: checked === true })
                  }
                />
                <Label
                  htmlFor={`stage-${draft.key}-email`}
                  className="font-normal"
                >
                  {t("sendEmail")}
                </Label>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => shift(index, -1)}
                >
                  <ArrowUpIcon aria-hidden />
                  <span className="sr-only">
                    {t("moveUp", { name: draft.name })}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === drafts.length - 1}
                  onClick={() => shift(index, 1)}
                >
                  <ArrowDownIcon aria-hidden />
                  <span className="sr-only">
                    {t("moveDown", { name: draft.name })}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((entry) => entry.key !== draft.key),
                    )
                  }
                >
                  <Trash2Icon aria-hidden />
                  <span className="sr-only">
                    {t("remove", { name: draft.name })}
                  </span>
                </Button>
              </div>
            </div>
            {draft.emailOn && (
              <div className="grid gap-3 md:grid-cols-2">
                {(["en", "fr"] as const).map((language) => (
                  <fieldset
                    key={language}
                    className="flex flex-col gap-2"
                    lang={language}
                  >
                    <legend className="text-sm font-medium">
                      {t(`email.${language}`)}
                    </legend>
                    <Label
                      htmlFor={`stage-${draft.key}-${language}-subject`}
                      className="sr-only"
                    >
                      {t("subject", { language: t(`email.${language}`) })}
                    </Label>
                    <Input
                      id={`stage-${draft.key}-${language}-subject`}
                      placeholder={t("subjectPlaceholder")}
                      value={
                        language === "en" ? draft.enSubject : draft.frSubject
                      }
                      onChange={(event) =>
                        update(
                          draft.key,
                          language === "en"
                            ? { enSubject: event.target.value }
                            : { frSubject: event.target.value },
                        )
                      }
                    />
                    <Label
                      htmlFor={`stage-${draft.key}-${language}-body`}
                      className="sr-only"
                    >
                      {t("body", { language: t(`email.${language}`) })}
                    </Label>
                    <Textarea
                      id={`stage-${draft.key}-${language}-body`}
                      rows={4}
                      placeholder={t("bodyPlaceholder")}
                      value={language === "en" ? draft.enBody : draft.frBody}
                      onChange={(event) =>
                        update(
                          draft.key,
                          language === "en"
                            ? { enBody: event.target.value }
                            : { frBody: event.target.value },
                        )
                      }
                    />
                  </fieldset>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDrafts((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                name: "",
                kind: "review",
                emailOn: false,
                enSubject: "",
                enBody: "",
                frSubject: "",
                frBody: "",
              },
            ])
          }
        >
          <PlusIcon aria-hidden />
          {t("add")}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
