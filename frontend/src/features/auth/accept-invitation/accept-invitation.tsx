"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { parseRoleList } from "@/common/auth/roles";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { getErrorCode } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "../_shared/auth-card";
import { sessionQueryOptions, useInvitation } from "./use-invitation";

export function AcceptInvitation() {
  const t = useTranslations("auth.invitation");
  const tAuth = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const errorMessage = useApiErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const session = useQuery(sessionQueryOptions);
  const { invitation, accept, decline, signOut } = useInvitation(
    id,
    Boolean(session.data),
  );
  const next = `/accept-invitation/${id}`;

  if (session.isPending || (session.data && invitation.isPending)) {
    return (
      <AuthCard title={t("heading")}>
        <Skeleton className="h-16 w-full" />
      </AuthCard>
    );
  }

  if (!session.data) {
    return (
      <AuthCard title={t("heading")} description={t("signInFirst")}>
        <div className="flex flex-col gap-3">
          <Link
            href={{ pathname: "/sign-in", query: { next } }}
            className={buttonVariants({ size: "lg" })}
          >
            {tAuth("signIn.submit")}
          </Link>
          <Link
            href={{ pathname: "/sign-up", query: { next } }}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {tAuth("signIn.signUpLink")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (!invitation.data) {
    const wrongRecipient =
      getErrorCode(invitation.error) ===
      "you_are_not_the_recipient_of_the_invitation";
    return (
      <AuthCard title={t("heading")}>
        <FormAlert
          message={
            wrongRecipient ? errorMessage(invitation.error) : t("notFound")
          }
        />
        {wrongRecipient && (
          <Button
            variant="outline"
            disabled={signOut.isPending}
            onClick={() =>
              signOut.mutate(undefined, {
                onSuccess: () =>
                  router.replace({ pathname: "/sign-in", query: { next } }),
              })
            }
          >
            {t("switchAccount")}
          </Button>
        )}
      </AuthCard>
    );
  }

  if (decline.isSuccess) return <AuthCard title={t("declined")} />;

  const details = invitation.data;
  const roles = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    parseRoleList(details.role).map((role) => tRoles(role)),
  );

  return (
    <AuthCard
      title={t("title", { school: details.organizationName })}
      description={t("description", {
        inviter: details.inviterEmail,
        school: details.organizationName,
        roles,
      })}
    >
      <FormAlert message={accept.error ? errorMessage(accept.error) : null} />
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          disabled={accept.isPending}
          onClick={() =>
            accept.mutate(undefined, {
              onSuccess: () => {
                router.refresh();
                router.replace("/");
              },
            })
          }
        >
          {t("accept")}
        </Button>
        <Button
          variant="ghost"
          disabled={decline.isPending}
          onClick={() => decline.mutate()}
        >
          {t("decline")}
        </Button>
      </div>
    </AuthCard>
  );
}
