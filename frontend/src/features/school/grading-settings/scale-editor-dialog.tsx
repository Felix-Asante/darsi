"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  type GradingScale,
  NUMERIC_SCALE_KINDS,
  SCALE_KINDS,
  type ScaleDefinition,
  type ScaleKind,
  type ScalePreset,
} from "@/common/types/assessment";
import { getFieldErrors } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { useValidationMessage } from "@/components/form/use-validation-message";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LevelRow {
  code: string;
  label: string;
  /** Percent as typed, so editing doesn't fight rounding. */
  from: string;
}

const EMPTY_PRESET = "";

const toRows = (definition: ScaleDefinition): LevelRow[] =>
  (definition.levels ?? []).map((level) => ({
    code: level.code,
    label: level.label ?? "",
    from: String(Math.round(level.minMastery * 10_000) / 100),
  }));

interface ScaleEditorDialogProps {
  presets: ScalePreset[];
  /** Edits this scale (saving a new version) instead of creating one. */
  scale?: GradingScale;
  onSave: (input: { name: string; definition: ScaleDefinition }) => Promise<unknown>;
}

export function ScaleEditorDialog({ presets, scale, onSave }: Readonly<ScaleEditorDialogProps>) {
  const t = useTranslations("gradingSettings.scales");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(EMPTY_PRESET);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ScaleKind>("letter");
  const [maxPoints, setMaxPoints] = useState("20");
  const [decimals, setDecimals] = useState("1");
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const numeric = NUMERIC_SCALE_KINDS.includes(kind);

  const load = (definition: ScaleDefinition, scaleName: string) => {
    setName(scaleName);
    setKind(definition.kind);
    setMaxPoints(String(definition.maxPoints ?? 20));
    setDecimals(String(definition.decimals ?? (definition.kind === "percentage" ? 0 : 1)));
    setLevels(toRows(definition));
  };

  const reset = () => {
    setErrors([]);
    setServerError(null);
    setPreset(EMPTY_PRESET);
    if (scale) load(scale.definition, scale.name);
    else load({ kind: "letter", levels: [] }, "");
  };

  const definition = (): ScaleDefinition =>
    numeric
      ? { kind, ...(kind === "points" ? { maxPoints: Number(maxPoints) } : {}), decimals: Number(decimals) }
      : {
          kind,
          levels: levels.map((level) => ({
            code: level.code.trim(),
            ...(level.label.trim() ? { label: level.label.trim() } : {}),
            minMastery: Math.round(Number(level.from.replace(",", ".")) * 100) / 10_000,
          })),
        };

  const save = async () => {
    setErrors([]);
    setServerError(null);
    if (!name.trim()) {
      setErrors(["required"]);
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), definition: definition() });
      toast.success(scale ? t("saved", { name }) : t("created", { name }));
      setOpen(false);
    } catch (error) {
      const codes = Object.values(getFieldErrors(error)).flat();
      if (codes.length > 0) setErrors(codes);
      else setServerError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const update = (index: number, patch: Partial<LevelRow>) =>
    setLevels((current) => current.map((level, position) => (position === index ? { ...level, ...patch } : level)));
  const kindItems = SCALE_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }));
  const presetItems = [{ value: EMPTY_PRESET, label: t("custom") }, ...presets.map((item) => ({ value: item.key, label: item.name }))];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={scale ? <Button variant="ghost" size="sm" /> : <Button />}>
        {!scale && <PlusIcon aria-hidden />}
        {scale ? t("edit") : t("add")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{scale ? scale.name : t("add")}</DialogTitle>
          <DialogDescription>{scale ? t("editNote") : t("description")}</DialogDescription>
        </DialogHeader>
        <FormAlert message={serverError} />
        {errors.length > 0 && (
          <ul role="alert" className="text-destructive list-inside list-disc text-sm">
            {[...new Set(errors)].map((code) => (
              <li key={code}>{validationMessage(code)}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-4">
          {!scale && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scale-preset">{t("startFrom")}</Label>
              <Select
                items={presetItems}
                value={preset}
                onValueChange={(value) => {
                  setPreset(value ?? EMPTY_PRESET);
                  const chosen = presets.find((item) => item.key === value);
                  if (chosen) load(chosen.definition, chosen.name);
                }}
              >
                <SelectTrigger id="scale-preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scale-name">{t("name")}</Label>
              <Input id="scale-name" value={name} autoComplete="off" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scale-kind">{t("kind")}</Label>
              <Select
                items={kindItems}
                value={kind}
                disabled={Boolean(scale)}
                onValueChange={(value) => value && setKind(value as ScaleKind)}
              >
                <SelectTrigger id="scale-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {numeric ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {kind === "points" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scale-max">{t("maxPoints")}</Label>
                  <Input id="scale-max" inputMode="decimal" value={maxPoints} onChange={(event) => setMaxPoints(event.target.value)} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scale-decimals">{t("decimals")}</Label>
                <Input id="scale-decimals" inputMode="numeric" value={decimals} onChange={(event) => setDecimals(event.target.value)} />
              </div>
            </div>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("levels")}</legend>
              <div className="text-muted-foreground grid grid-cols-[5rem_1fr_6rem_2rem] gap-2 text-xs" aria-hidden>
                <span>{t("code")}</span>
                <span>{t("label")}</span>
                <span>{t("from")}</span>
              </div>
              {levels.map((level, index) => (
                <div key={index} className="grid grid-cols-[5rem_1fr_6rem_2rem] items-center gap-2">
                  <Input
                    aria-label={`${t("code")} ${index + 1}`}
                    value={level.code}
                    onChange={(event) => update(index, { code: event.target.value })}
                  />
                  <Input
                    aria-label={`${t("label")} ${index + 1}`}
                    value={level.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                  <Input
                    aria-label={`${t("from")} ${index + 1}`}
                    inputMode="decimal"
                    className="tabular-nums"
                    value={level.from}
                    onChange={(event) => update(index, { from: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeLevel", { code: level.code || String(index + 1) })}
                    onClick={() => setLevels((current) => current.filter((_, position) => position !== index))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setLevels((current) => [...current, { code: "", label: "", from: current.length ? "" : "0" }])}
              >
                <PlusIcon aria-hidden />
                {t("addLevel")}
              </Button>
            </fieldset>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
