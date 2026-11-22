"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RemoveMemberDialogProps {
  name: string;
  schoolName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<unknown>;
}

export function RemoveMemberDialog({ name, schoolName, open, onOpenChange, onConfirm }: Readonly<RemoveMemberDialogProps>) {
  const t = useTranslations("settings.members");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const [removing, setRemoving] = useState(false);

  const confirm = async () => {
    setRemoving(true);
    await onConfirm().then(
      () => onOpenChange(false),
      (error: unknown) => toast.error(errorMessage(error)),
    );
    setRemoving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { name })}</DialogTitle>
          <DialogDescription>{t("removeDescription", { school: schoolName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button variant="destructive" disabled={removing} onClick={confirm}>
            {t("removeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
