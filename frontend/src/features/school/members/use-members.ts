import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/common/auth/roles";
import {
  getInvitationsQueryOptions,
  getMembersQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/identity";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";

export function useMembers(schoolId: string) {
  const queryClient = useQueryClient();
  const members = useQuery(getMembersQueryOptions(schoolId));
  const invitations = useQuery(getInvitationsQueryOptions(schoolId));
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.school.members(schoolId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.school.invitations(schoolId) }),
    ]);

  const invite = useMutation({
    mutationFn: ({ email, roles }: { email: string; roles: Role[] }) => api.members.invite({ schoolId, email, roles }),
    onSuccess: refresh,
  });
  const updateRoles = useMutation({
    mutationFn: ({ memberId, roles }: { memberId: string; roles: Role[] }) =>
      api.members.updateRoles({ schoolId, memberId, roles }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => api.members.remove({ schoolId, memberId }),
    onSuccess: refresh,
  });
  const cancelInvitation = useMutation({
    mutationFn: (invitationId: string) => api.members.cancelInvitation(invitationId),
    onSuccess: refresh,
  });

  return { members, invitations, invite, updateRoles, remove, cancelInvitation };
}
