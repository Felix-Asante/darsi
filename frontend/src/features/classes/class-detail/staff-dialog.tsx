"use client";

import { useQuery } from "@tanstack/react-query";
import { UsersRoundIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getMembersQueryOptions } from "@/common/integrations/tanstack-query/query-options/identity";
import { CLASS_STAFF_ROLES, type ClassStaffMember, type ClassStaffRole } from "@/common/types/academics";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MemberOption {
  value: string;
  label: string;
  email: string;
}

interface StaffDialogProps {
  staff: ClassStaffMember[];
  onSave: (staff: { userId: string; role: ClassStaffRole }[]) => Promise<unknown>;
}

export function StaffDialog({ staff, onSave }: Readonly<StaffDialogProps>) {
  const t = useTranslations("classes");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const [open, setOpen] = useState(false);
  const members = useQuery({ ...getMembersQueryOptions(school.id), enabled: open });
  const [draft, setDraft] = useState<ClassStaffMember[]>(staff);
  const [member, setMember] = useState<MemberOption | null>(null);
  const [role, setRole] = useState<ClassStaffRole>("teacher");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const options: MemberOption[] = (members.data ?? [])
    .filter((candidate) => !draft.some((existing) => existing.userId === candidate.userId))
    .map((candidate) => ({ value: candidate.userId, label: candidate.user.name, email: candidate.user.email }));
  const roleItems = CLASS_STAFF_ROLES.map((value) => ({ value, label: t(`staffRoles.${value}`) }));

  const add = () => {
    if (!member) return;
    setDraft((current) => [...current, { userId: member.value, name: member.label, email: member.email, role }]);
    setMember(null);
  };

  const save = async () => {
    setSaving(true);
    setServerError(null);
    try {
      await onSave(draft.map(({ userId, role: staffRole }) => ({ userId, role: staffRole })));
      toast.success(t("staffDialog.saved"));
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
        if (next) setDraft(staff);
        setServerError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UsersRoundIcon aria-hidden />
        {t("detail.editStaff")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staffDialog.title")}</DialogTitle>
          <DialogDescription>{t("staffDialog.description")}</DialogDescription>
        </DialogHeader>
        <FormAlert message={serverError ?? (members.error ? errorMessage(members.error) : null)} />

        {draft.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("staffDialog.empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {draft.map((entry) => (
              <li key={entry.userId} className="flex items-center gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{entry.name}</span>
                  <span className="text-muted-foreground text-xs">{t(`staffRoles.${entry.role}`)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("staffDialog.removeLabel", { name: entry.name })}
                  onClick={() => setDraft((current) => current.filter((existing) => existing.userId !== entry.userId))}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-member">{t("staffDialog.member")}</Label>
            <Combobox
              items={options}
              value={member}
              onValueChange={(option: MemberOption | null) => setMember(option)}
              itemToStringLabel={(option: MemberOption) => option.label}
              isItemEqualToValue={(option: MemberOption, value: MemberOption) => option.value === value.value}
            >
              <ComboboxInput id="staff-member" className="w-full" triggerLabel={t("staffDialog.member")} />
              <ComboboxContent>
                <ComboboxEmpty>{tCommon("noResults")}</ComboboxEmpty>
                <ComboboxList>
                  {(option: MemberOption) => (
                    <ComboboxItem key={option.value} value={option}>
                      <span className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-muted-foreground text-xs">{option.email}</span>
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="staff-role">{t("staffDialog.role")}</Label>
            <Select items={roleItems} value={role} onValueChange={(value) => value && setRole(value as ClassStaffRole)}>
              <SelectTrigger id="staff-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" disabled={!member} onClick={add}>
            {t("staffDialog.add")}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
