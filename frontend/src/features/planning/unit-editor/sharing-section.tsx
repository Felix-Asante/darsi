"use client";

import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool, useMe } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getMembersQueryOptions } from "@/common/integrations/tanstack-query/query-options/identity";
import type { UnitPlan } from "@/common/types/daily";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnitHandle } from "./use-unit";

type Role = "editor" | "viewer";

/** The owner shares the unit with colleagues as editors or viewers (PLN-4). */
export function SharingSection({ unit, handle }: Readonly<{ unit: UnitPlan; handle: UnitHandle }>) {
  const t = useTranslations("planning.unit");
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const { user } = useMe();
  const members = useQuery(getMembersQueryOptions(school.id));
  const [draft, setDraft] = useState(unit.collaborators);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const options = (members.data ?? [])
    .filter((member) => member.userId !== user.id && !draft.some((entry) => entry.userId === member.userId))
    .map((member) => ({ value: member.userId, label: member.user.name }));
  const roleItems = (["editor", "viewer"] as const).map((value) => ({ value, label: t(`roles.${value}`) }));

  return (
    <section aria-labelledby="sharing-title" className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <h2 id="sharing-title" className="text-base font-semibold">
        {t("sharing")}
      </h2>
      <ul className="flex flex-col gap-1">
        {draft.map((entry) => (
          <li key={entry.userId} className="flex items-center gap-3 text-sm">
            <span className="flex-1">{entry.name}</span>
            <span className="text-muted-foreground">{t(`roles.${entry.role}`)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeCollaborator", { name: entry.name })}
              onClick={() => setDraft((current) => current.filter((existing) => existing.userId !== entry.userId))}
            >
              <XIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="collaborator">{t("collaborator")}</Label>
          <Select items={options} value={userId} onValueChange={(value) => setUserId(value ?? "")}>
            <SelectTrigger id="collaborator" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-32">
          <Label htmlFor="collaborator-role">{t("role")}</Label>
          <Select items={roleItems} value={role} onValueChange={(value) => value && setRole(value as Role)}>
            <SelectTrigger id="collaborator-role" className="w-full">
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
        <Button
          type="button"
          variant="secondary"
          disabled={!userId}
          onClick={() => {
            const label = options.find((option) => option.value === userId)?.label ?? "";
            setDraft((current) => [...current, { userId, role, name: label }]);
            setUserId("");
          }}
        >
          {t("addCollaborator")}
        </Button>
      </div>
      <Button
        className="self-start"
        disabled={handle.setCollaborators.isPending}
        onClick={() =>
          handle.setCollaborators.mutate(
            draft.map(({ userId: id, role: entryRole }) => ({ userId: id, role: entryRole })),
            { onSuccess: () => toast.success(t("sharingSaved")), onError: (error) => toast.error(errorMessage(error)) },
          )
        }
      >
        {t("saveSharing")}
      </Button>
    </section>
  );
}
