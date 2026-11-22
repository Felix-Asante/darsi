import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getStudentQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { api } from "@/common/service/api";
import type { GuardianInput, Relationship } from "@/common/types/people";

export interface AddGuardianInput extends GuardianInput {
  relationship: Relationship;
  isPrimaryContact: boolean;
}

export function useStudent(id: string) {
  const queryClient = useQueryClient();
  const student = useQuery(getStudentQueryOptions(id));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.people.all() });

  /** Reuses the guardian with this email if the school already has one, so siblings share a family. */
  const addGuardian = useMutation({
    mutationFn: async ({
      relationship,
      isPrimaryContact,
      ...guardian
    }: AddGuardianInput) => {
      const { data: matches } = await api.people.listGuardians(guardian.email);
      const existing = matches.find(
        (match) => match.email.toLowerCase() === guardian.email.toLowerCase(),
      );
      const guardianId =
        existing?.id ?? (await api.people.createGuardian(guardian)).data.id;
      return api.people.linkGuardian(id, {
        guardianId,
        relationship,
        isPrimaryContact,
      });
    },
    onSuccess: refresh,
  });

  const unlinkGuardian = useMutation({
    mutationFn: (guardianId: string) =>
      api.people.unlinkGuardian(id, guardianId),
    onSuccess: refresh,
  });

  return { student, addGuardian, unlinkGuardian };
}
