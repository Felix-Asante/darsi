"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import type { Role } from "@/common/auth/roles";
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
import { RoleCheckboxes } from "./role-checkboxes";

interface EditRolesDialogProps {
  name: string;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (roles: Role[]) => Promise<unknown>;
}

export function EditRolesDialog({ name, roles, open, onOpenChange, onSave }: Readonly<EditRolesDialogProps>) {
  const t = useTranslations("settings.members");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const errorMessage = useApiErrorMessage();
  const [selected, setSelected] = useState(roles);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(selected).then(
      () => {
        toast.success(tCommon("saved"));
        onOpenChange(false);
      },
      (error: unknown) => toast.error(errorMessage(error)),
    );
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editRoles")}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <RoleCheckboxes
          legend={t("roles")}
          value={selected}
          onChange={setSelected}
          error={selected.length === 0 ? tValidation("rolesRequired") : undefined}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button disabled={saving || selected.length === 0} onClick={save}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
