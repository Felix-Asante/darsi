"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useMe } from "@/common/auth/me-context";
import { parseRoleList } from "@/common/auth/roles";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { Member } from "@/common/types/identity";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditRolesDialog } from "./edit-roles-dialog";
import { InviteDialog } from "./invite-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { useMembers } from "./use-members";

type DialogState = { kind: "roles" | "remove"; member: Member } | null;

export function MembersManager() {
  const t = useTranslations("settings.members");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const errorMessage = useApiErrorMessage();
  const { user, currentSchool } = useMe();
  const { members, invitations, invite, updateRoles, remove, cancelInvitation } = useMembers(currentSchool.id);
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <section aria-labelledby="members-title" className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="members-title" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        <InviteDialog onInvite={(values) => invite.mutateAsync(values)} />
      </div>

      <FormAlert message={members.error ? errorMessage(members.error) : null} />
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("member")}</TableHead>
              <TableHead>{t("roles")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("joined")}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{tCommon("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.isPending
              ? Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : (members.data ?? []).map((member) => {
                  const isYou = member.userId === user.id;
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {member.user.name}
                            {isYou && <span className="text-muted-foreground font-normal"> · {t("you")}</span>}
                          </span>
                          <span className="text-muted-foreground text-xs">{member.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parseRoleList(member.role).map((role) => (
                            <Badge key={role} variant="secondary">
                              {tRoles(role)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        <time dateTime={member.createdAt}>
                          {format.dateTime(new Date(member.createdAt), { dateStyle: "medium" })}
                        </time>
                      </TableCell>
                      <TableCell>
                        {!isYou && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`${tCommon("actions")}: ${member.user.name}`}
                                />
                              }
                            >
                              <MoreHorizontalIcon aria-hidden />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDialog({ kind: "roles", member })}>
                                {t("editRoles")}
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => setDialog({ kind: "remove", member })}>
                                {tCommon("remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <h3 id="pending-title" className="text-base font-semibold tracking-tight">
          {t("pending")}
        </h3>
        {invitations.data && invitations.data.length > 0 ? (
          <ul className="bg-card divide-y rounded-lg border">
            {invitations.data.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{invitation.email}</span>
                  <span className="text-muted-foreground text-xs">
                    {parseRoleList(invitation.role)
                      .map((role) => tRoles(role))
                      .join(", ")}
                    {" · "}
                    {t("expires", { date: format.dateTime(new Date(invitation.expiresAt), { dateStyle: "medium" }) })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cancelInvitation.isPending}
                  onClick={() => cancelInvitation.mutate(invitation.id)}
                >
                  {t("cancelInvitation")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{invitations.isPending ? tCommon("loading") : t("pendingEmpty")}</p>
        )}
      </section>

      {dialog?.kind === "roles" && (
        <EditRolesDialog
          open
          name={dialog.member.user.name}
          roles={parseRoleList(dialog.member.role)}
          onOpenChange={(open) => !open && setDialog(null)}
          onSave={(roles) => updateRoles.mutateAsync({ memberId: dialog.member.id, roles })}
        />
      )}
      {dialog?.kind === "remove" && (
        <RemoveMemberDialog
          open
          name={dialog.member.user.name}
          schoolName={currentSchool.name}
          onOpenChange={(open) => !open && setDialog(null)}
          onConfirm={() => remove.mutateAsync(dialog.member.id)}
        />
      )}
    </section>
  );
}
