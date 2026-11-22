import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { isNotFoundError } from "@/common/utils/errors";
import { queryKeys } from "../query-keys";

export const getMeQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.me.all(),
    queryFn: ({ signal }) =>
      api.me.get({ signal }).then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

export const getMembersQueryOptions = (schoolId: string) =>
  queryOptions({
    queryKey: queryKeys.school.members(schoolId),
    queryFn: () =>
      api.members.list(schoolId).then((response) => response.data.members),
    enabled: Boolean(schoolId),
  });

export const getInvitationsQueryOptions = (schoolId: string) =>
  queryOptions({
    queryKey: queryKeys.school.invitations(schoolId),
    queryFn: () =>
      api.members
        .listInvitations(schoolId)
        .then((response) =>
          response.data.filter((invitation) => invitation.status === "pending"),
        ),
    enabled: Boolean(schoolId),
  });

export const getInvitationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.invitation.detail(id),
    queryFn: () =>
      api.members.getInvitation(id).then((response) => response.data),
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 1,
  });
