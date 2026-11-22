import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import { queryKeys } from "../query-keys";

const keys = queryKeys.admissions;

export const getPublicAdmissionsQueryOptions = () =>
  queryOptions({
    queryKey: keys.publicPage(),
    queryFn: ({ signal }) =>
      api.admissions.publicPage({ signal }).then((r) => r.data),
  });

export const getMyApplicationsQueryOptions = () =>
  queryOptions({
    queryKey: keys.mine(),
    queryFn: ({ signal }) =>
      api.admissions.myApplications({ signal }).then((r) => r.data),
  });

export const getMyApplicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.myApplication(id),
    queryFn: ({ signal }) =>
      api.admissions.myApplication(id, { signal }).then((r) => r.data),
  });

export const getCyclesQueryOptions = () =>
  queryOptions({
    queryKey: keys.cycles(),
    queryFn: ({ signal }) =>
      api.admissions.cycles({ signal }).then((r) => r.data),
  });

export const getPlacesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.places(id),
    queryFn: ({ signal }) =>
      api.admissions.places(id, { signal }).then((r) => r.data),
    enabled: Boolean(id),
  });

export const getAdmissionFormsQueryOptions = () =>
  queryOptions({
    queryKey: keys.forms(),
    queryFn: ({ signal }) =>
      api.admissions.forms({ signal }).then((r) => r.data),
  });

export const getStagesQueryOptions = () =>
  queryOptions({
    queryKey: keys.stages(),
    queryFn: ({ signal }) =>
      api.admissions.stages({ signal }).then((r) => r.data),
  });

export const getApplicationsQueryOptions = (query: {
  cycleId?: string;
  stageId?: string;
  gradeLevelId?: string;
}) =>
  queryOptions({
    queryKey: keys.applications(query),
    queryFn: ({ signal }) =>
      api.admissions.applications(query, { signal }).then((r) => r.data),
  });

export const getApplicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.application(id),
    queryFn: ({ signal }) =>
      api.admissions.application(id, { signal }).then((r) => r.data),
  });

export const getReEnrolmentsQueryOptions = (yearId: string) =>
  queryOptions({
    queryKey: keys.reEnrolments(yearId),
    queryFn: ({ signal }) =>
      api.admissions.reEnrolments(yearId, { signal }).then((r) => r.data),
    enabled: Boolean(yearId),
  });

export const getMyReEnrolmentsQueryOptions = () =>
  queryOptions({
    queryKey: keys.myReEnrolments(),
    queryFn: ({ signal }) =>
      api.admissions.myReEnrolments({ signal }).then((r) => r.data),
  });
