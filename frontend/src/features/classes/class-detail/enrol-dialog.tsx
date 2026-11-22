"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useDebouncedValue } from "@/common/hooks/use-debounced-value";
import { getStudentSearchQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import type { StudentSummary } from "@/common/types/people";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

interface EnrolDialogProps {
  enrolledIds: string[];
  onEnrol: (studentIds: string[]) => Promise<unknown>;
}

export function EnrolDialog({ enrolledIds, onEnrol }: Readonly<EnrolDialogProps>) {
  const t = useTranslations("classes");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, StudentSummary>>(new Map());
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const candidates = useQuery(getStudentSearchQueryOptions(debouncedSearch, open));

  const toggle = (student: StudentSummary, checked: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(student.id, student);
      else next.delete(student.id);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    setServerError(null);
    try {
      await onEnrol([...selected.keys()]);
      toast.success(t("enrolDialog.enrolled", { count: selected.size }));
      setOpen(false);
    } catch (error) {
      setServerError(errorMessage(error));
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
          setSelected(new Map());
          setSearch("");
        }
        setServerError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlusIcon aria-hidden />
        {t("detail.enrol")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("enrolDialog.title")}</DialogTitle>
          <DialogDescription>{t("enrolDialog.description")}</DialogDescription>
        </DialogHeader>
        <FormAlert message={serverError ?? (candidates.error ? errorMessage(candidates.error) : null)} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enrol-search">{t("enrolDialog.search")}</Label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="enrol-search"
              type="search"
              value={search}
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
        </div>
        <fieldset className="max-h-72 overflow-y-auto rounded-md border" aria-busy={candidates.isFetching}>
          <legend className="sr-only">{t("enrolDialog.title")}</legend>
          {candidates.data?.length === 0 && (
            <p className="text-muted-foreground px-3 py-4 text-sm">{tCommon("noResults")}</p>
          )}
          <ul className="divide-y">
            {(candidates.data ?? []).map((student) => {
              const enrolled = enrolledIds.includes(student.id);
              const id = `enrol-${student.id}`;
              return (
                <li key={student.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    id={id}
                    disabled={enrolled}
                    checked={enrolled || selected.has(student.id)}
                    onCheckedChange={(checked) => toggle(student, checked === true)}
                  />
                  <label htmlFor={id} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">
                      {student.lastName}, {student.preferredName ?? student.firstName}
                    </span>
                    <code className="text-muted-foreground text-xs">{student.studentNumber}</code>
                    {enrolled && <span className="text-muted-foreground text-xs">{t("enrolDialog.alreadyEnrolled")}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
        <DialogFooter className="items-center">
          <p className="text-muted-foreground me-auto text-sm tabular-nums" aria-live="polite">
            {t("enrolDialog.selected", { count: selected.size })}
          </p>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={saving || selected.size === 0} onClick={submit}>
            {t("enrolDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
