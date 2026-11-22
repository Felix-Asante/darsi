"use client";

import { useQuery } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnitHandle } from "./use-unit";

/** Copies the unit for other classes or next year (PLN-6). */
export function CopyDialog({ handle }: Readonly<{ handle: UnitHandle }>) {
  const t = useTranslations("planning.unit");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [shiftDays, setShiftDays] = useState("0");
  const classes = useQuery({ ...getClassesQueryOptions({ mine: true }), enabled: open });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CopyIcon aria-hidden />
        {t("copy")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("copyTitle")}</DialogTitle>
          <DialogDescription>{t("copyDescription")}</DialogDescription>
        </DialogHeader>
        <FormAlert message={handle.copy.error ? errorMessage(handle.copy.error) : null} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("copyClasses")}</legend>
          {(classes.data ?? []).map((schoolClass) => (
            <label key={schoolClass.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={classIds.includes(schoolClass.id)}
                onCheckedChange={(checked) =>
                  setClassIds((current) => (checked === true ? [...current, schoolClass.id] : current.filter((id) => id !== schoolClass.id)))
                }
              />
              {schoolClass.name}
            </label>
          ))}
        </fieldset>
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="copy-shift">{t("shiftDays")}</Label>
          <Input id="copy-shift" inputMode="numeric" value={shiftDays} onChange={(event) => setShiftDays(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            disabled={classIds.length === 0 || handle.copy.isPending}
            onClick={() =>
              handle.copy.mutate(
                { classIds, shiftDays: Number(shiftDays) || 0 },
                {
                  onSuccess: (copy) => {
                    toast.success(t("copied"));
                    setOpen(false);
                    router.push(`/planning/units/${copy.id}`);
                  },
                },
              )
            }
          >
            {t("copySubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
