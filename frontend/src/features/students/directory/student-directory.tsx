"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useDebouncedValue } from "@/common/hooks/use-debounced-value";
import { Link } from "@/common/i18n/navigation";
import { getGradeLevelsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import type { StudentStatus } from "@/common/types/people";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddStudentDialog } from "./add-student-dialog";
import { useStudents } from "./use-students";

const ALL = "";

export function StudentDirectory() {
  const t = useTranslations("students");
  const errorMessage = useApiErrorMessage();
  const canManage = useHasRole("admin");
  const [search, setSearch] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState(ALL);
  const [status, setStatus] = useState<StudentStatus | "">("active");
  const debouncedSearch = useDebouncedValue(search.trim());
  const gradeLevels = useQuery(getGradeLevelsQueryOptions());
  const students = useStudents({
    search: debouncedSearch,
    gradeLevelId,
    status,
  });

  const rows = students.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Boolean(
    debouncedSearch || gradeLevelId || status !== "active",
  );
  const gradeItems = [
    { value: ALL, label: t("allGrades") },
    ...(gradeLevels.data ?? []),
  ];
  const statusItems = [
    { value: "active", label: t("statuses.active") },
    { value: "withdrawn", label: t("statuses.withdrawn") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("description")}
          </p>
        </div>
        {canManage && <AddStudentDialog gradeLevels={gradeLevels.data ?? []} />}
      </div>

      <div className="flex flex-wrap items-end gap-3" role="search">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="student-search">{t("searchLabel")}</Label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="student-search"
              type="search"
              value={search}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="grade-filter">{t("gradeFilter")}</Label>
          <Select
            items={gradeItems}
            value={gradeLevelId}
            onValueChange={(value) => setGradeLevelId(value ?? ALL)}
          >
            <SelectTrigger id="grade-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gradeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-40">
          <Label htmlFor="status-filter">{t("statusFilter")}</Label>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(value) =>
              setStatus((value as StudentStatus | null) ?? "active")
            }
          >
            <SelectTrigger id="status-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormAlert
        message={students.error ? errorMessage(students.error) : null}
      />

      {students.isSuccess && rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>
              {filtered ? t("noMatches") : t("emptyTitle")}
            </EmptyTitle>
            {!filtered && (
              <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("number")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("grade")}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-busy={students.isFetching}>
              {students.isPending
                ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Link
                          href={`/students/${student.id}`}
                          className="font-medium hover:underline"
                        >
                          {student.lastName},{" "}
                          {student.preferredName ?? student.firstName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code className="text-muted-foreground text-xs">
                          {student.studentNumber}
                        </code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {student.gradeLevel?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={
                            student.status === "active"
                              ? "success"
                              : "secondary"
                          }
                        >
                          {t(`statuses.${student.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-muted-foreground text-sm tabular-nums"
            aria-live="polite"
          >
            {t("count", { count: rows.length })}
          </p>
          {students.hasNextPage && (
            <Button
              variant="outline"
              disabled={students.isFetchingNextPage}
              onClick={() => students.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
