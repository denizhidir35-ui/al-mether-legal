export type CaseListStatusFilter =
  | "all"
  | "active"
  | "archive";

const ARCHIVE_STATUSES =
  new Set([
    "closed",
    "archived",
    "completed",
    "inactive",
  ]);

export function isArchiveCaseStatus(
  status: string | null | undefined
) {
  return ARCHIVE_STATUSES.has(
    status
      ?.trim()
      .toLocaleLowerCase("tr-TR") ||
      ""
  );
}

export function matchesCaseStatusFilter(
  status: string | null | undefined,
  filter: CaseListStatusFilter
) {
  if (filter === "all") {
    return true;
  }

  const archived =
    isArchiveCaseStatus(status);

  return filter === "archive"
    ? archived
    : !archived;
}
