import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getInvitationQueryOptions } from "@/common/integrations/tanstack-query/query-options/identity";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";

export const sessionQueryOptions = {
  queryKey: ["auth", "session"] as const,
  queryFn: () => api.auth.getSession().then((response) => response.data),
};

export function useInvitation(invitationId: string, signedIn: boolean) {
  const queryClient = useQueryClient();
  const invitation = useQuery({
    ...getInvitationQueryOptions(invitationId),
    enabled: signedIn,
  });

  const accept = useMutation({
    mutationFn: async () => {
      await api.members.acceptInvitation(invitationId);
      if (invitation.data)
        await api.members.setActiveSchool(invitation.data.organizationId);
    },
    onSuccess: () =>
      queryClient.removeQueries({ queryKey: queryKeys.me.all() }),
  });

  const decline = useMutation({
    mutationFn: () => api.members.rejectInvitation(invitationId),
  });

  const signOut = useMutation({
    mutationFn: () => api.auth.signOut(),
    onSuccess: () => queryClient.clear(),
  });

  return { invitation, accept, decline, signOut };
}
