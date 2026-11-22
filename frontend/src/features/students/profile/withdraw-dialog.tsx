"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { todayIn } from "@/common/lib/calendar-date";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
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

/** Records that a student leaves: the record stays, class places end on the date (ADMS-14). */
export function WithdrawDialog({
  studentId,
  name,
}: Readonly<{ studentId: string; name: string }>) {
  const t = useTranslations("students.withdraw");
  const school = useCurrentSchool();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [leavingOn, setLeavingOn] = useState(() => todayIn(school.timeZone));
  const [reason, setReason] = useState("");
  const withdraw = useMutation({
    mutationFn: () =>
      api.admissions.withdraw(studentId, { leavingOn, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success(t("done", { name }));
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.people.all() });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {t("open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (leavingOn && reason.trim()) withdraw.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title", { name })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <FormAlert
            message={withdraw.error ? errorMessage(withdraw.error) : null}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-date">{t("leavingOn")}</Label>
            <Input
              id="withdraw-date"
              type="date"
              className="w-44"
              value={leavingOn}
              onChange={(event) => setLeavingOn(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-reason">{t("reason")}</Label>
            <Textarea
              id="withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || withdraw.isPending}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
