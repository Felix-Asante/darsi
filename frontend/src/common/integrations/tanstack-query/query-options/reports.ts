import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

export const getReportTemplatesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.reports.templates(),
    queryFn: ({ signal }) =>
      api.reports.templates({ signal }).then((response) => response.data),
  });

export const getReportCardsQueryOptions = (termId: string) =>
  queryOptions({
    queryKey: queryKeys.reports.cards(termId),
    queryFn: ({ signal }) =>
      api.reports.cards(termId, { signal }).then((response) => response.data),
    enabled: Boolean(termId),
  });

export const getReportClassSheetQueryOptions = (
  termId: string,
  classId: string,
) =>
  queryOptions({
    queryKey: queryKeys.reports.classSheet(termId, classId),
    queryFn: ({ signal }) =>
      api.reports
        .classSheet(termId, classId, { signal })
        .then((response) => response.data),
    enabled: Boolean(termId && classId),
  });

export const getReportCardQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.reports.card(id),
    queryFn: ({ signal }) =>
      api.reports.card(id, { signal }).then((response) => response.data),
  });
