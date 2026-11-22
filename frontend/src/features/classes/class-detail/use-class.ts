import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassQueryOptions, getRosterQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { api } from "@/common/service/api";
import type { ClassStaffRole } from "@/common/types/academics";

export function useClass(id: string) {
  const queryClient = useQueryClient();
  const schoolClass = useQuery(getClassQueryOptions(id));
  const roster = useQuery({ ...getRosterQueryOptions(id), enabled: schoolClass.isSuccess });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.academics.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all() }),
    ]);

  const setStaff = useMutation({
    mutationFn: (staff: { userId: string; role: ClassStaffRole }[]) => api.academics.setStaff(id, staff),
    onSuccess: refresh,
  });
  const enrol = useMutation({
    mutationFn: (studentIds: string[]) => api.academics.enrol(id, studentIds),
    onSuccess: refresh,
  });
  const unenrol = useMutation({
    mutationFn: (studentId: string) => api.academics.unenrol(id, studentId),
    onSuccess: refresh,
  });

  return { schoolClass, roster, setStaff, enrol, unenrol };
}
