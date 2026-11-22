import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getImportColumnsQueryOptions,
  getImportsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/imports";
import { api } from "@/common/service/api";
import type { ImportKind } from "@/common/types/people";

export function useImports() {
  const queryClient = useQueryClient();
  const jobs = useQuery(getImportsQueryOptions());
  const columns = useQuery(getImportColumnsQueryOptions());

  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: ImportKind; file: File }) =>
      api.imports.create({ kind, fileName: file.name, content: await file.text() }).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.imports.all() }),
  });

  return { jobs, columns, upload };
}

/** What an import changed, so the screens that show it refetch once it finishes. */
export function useRefreshAfterImports() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.academics.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.all() }),
    ]);
}
