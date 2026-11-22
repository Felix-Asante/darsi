import type { CursorQuery } from "@/common/types/api";
import type { StudentListQuery } from "@/common/types/people";

export const queryKeys = {
  health: {
    all: () => ["health"] as const,
    readiness: () => ["health", "readiness"] as const,
  },
  /** Everything that depends on who is signed in and in which school. */
  me: {
    all: () => ["me"] as const,
  },
  school: {
    all: () => ["school"] as const,
    current: () => ["school", "current"] as const,
    members: (schoolId: string) => ["school", "members", schoolId] as const,
    invitations: (schoolId: string) =>
      ["school", "invitations", schoolId] as const,
  },
  invitation: {
    detail: (id: string) => ["invitation", id] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
    list: (query: CursorQuery = {}) =>
      ["notifications", "list", query] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },

  academics: {
    all: () => ["academics"] as const,
    years: () => ["academics", "years"] as const,
    divisions: () => ["academics", "divisions"] as const,
    subjects: () => ["academics", "subjects"] as const,
    classes: (query: { academicYearId?: string; mine?: boolean } = {}) =>
      ["academics", "classes", query] as const,
    class: (id: string) => ["academics", "class", id] as const,
    roster: (id: string) => ["academics", "roster", id] as const,
    terms: (yearId: string) => ["academics", "terms", yearId] as const,
  },
  /** Students and guardians. Enrolling also changes rosters, so invalidate `academics` too. */
  people: {
    all: () => ["people"] as const,
    students: (query: StudentListQuery = {}) =>
      ["people", "students", query] as const,
    mine: () => ["people", "mine"] as const,
    studentSearch: (search: string) =>
      ["people", "student-search", search] as const,
    student: (id: string) => ["people", "student", id] as const,
    guardians: (search = "") => ["people", "guardians", search] as const,
  },
  curriculum: {
    all: () => ["curriculum"] as const,
    frameworks: () => ["curriculum", "frameworks"] as const,
    standards: (frameworkId: string) =>
      ["curriculum", "standards", frameworkId] as const,
  },
  imports: {
    all: () => ["imports"] as const,
    list: () => ["imports", "list"] as const,
    columns: () => ["imports", "columns"] as const,
    job: (id: string) => ["imports", "job", id] as const,
  },

  calendar: {
    all: () => ["calendar"] as const,
    items: (from: string, to: string) =>
      ["calendar", "items", from, to] as const,
  },
  /** Lessons depend on calendar days off too, so calendar changes invalidate this as well. */
  timetables: {
    all: () => ["timetables"] as const,
    mine: (from: string, to: string) =>
      ["timetables", "mine", from, to] as const,
    student: (studentId: string, from: string, to: string) =>
      ["timetables", "student", studentId, from, to] as const,
    classSlots: (classId: string) =>
      ["timetables", "class-slots", classId] as const,
    schedules: () => ["timetables", "schedules"] as const,
  },

  grading: {
    all: () => ["grading"] as const,
    presets: () => ["grading", "presets"] as const,
    scales: () => ["grading", "scales"] as const,
    conversions: () => ["grading", "conversions"] as const,
    policies: () => ["grading", "policies"] as const,
  },
  /** Grades, gradebooks and assessments; grading changes can alter results, so it is invalidated with `grading` too. */
  assessment: {
    all: () => ["assessment"] as const,
    forClass: (classId: string) => ["assessment", "class", classId] as const,
    sheet: (id: string) => ["assessment", "sheet", id] as const,
    gradebook: (classId: string, termId = "") =>
      ["assessment", "gradebook", classId, termId] as const,
    studentGrades: (studentId: string, termId = "") =>
      ["assessment", "student", studentId, termId] as const,
  },

  attendance: {
    all: () => ["attendance"] as const,
    settings: () => ["attendance", "settings"] as const,
    statuses: () => ["attendance", "statuses"] as const,
    sheet: (classId: string, date: string, periodId = "") =>
      ["attendance", "sheet", classId, date, periodId] as const,
    summary: (studentId: string, from: string, to: string) =>
      ["attendance", "summary", studentId, from, to] as const,
    report: (query: object) => ["attendance", "report", query] as const,
  },
  announcements: {
    all: () => ["announcements"] as const,
    feed: () => ["announcements", "feed"] as const,
    scheduled: () => ["announcements", "scheduled"] as const,
    classSettings: (classId: string) =>
      ["announcements", "class-settings", classId] as const,
  },
  planning: {
    all: () => ["planning"] as const,
    templates: () => ["planning", "templates"] as const,
    mine: () => ["planning", "mine"] as const,
    forClass: (classId: string) => ["planning", "class", classId] as const,
    unit: (id: string) => ["planning", "unit", id] as const,
  },

  files: {
    all: () => ["files"] as const,
    drive: (classId: string, folderId = "") =>
      ["files", "drive", classId, folderId] as const,
    attachments: (targetType: string, targetId: string) =>
      ["files", "attachments", targetType, targetId] as const,
    studentFiles: (studentId: string) =>
      ["files", "student", studentId] as const,
    usage: () => ["files", "usage"] as const,
  },

  portfolio: {
    all: () => ["portfolio"] as const,
    overview: (studentId: string) =>
      ["portfolio", "overview", studentId] as const,
    items: (studentId: string) => ["portfolio", "items", studentId] as const,
    classItems: (classId: string) => ["portfolio", "class", classId] as const,
    settings: () => ["portfolio", "settings"] as const,
  },
  reports: {
    all: () => ["reports"] as const,
    templates: () => ["reports", "templates"] as const,
    cards: (termId: string) => ["reports", "cards", termId] as const,
    classSheet: (termId: string, classId: string) =>
      ["reports", "class", termId, classId] as const,
    card: (id: string) => ["reports", "card", id] as const,
  },

  /** Every billing query: any payment or invoice change refreshes them all. */
  billing: {
    all: () => ["billing"] as const,
    settings: () => ["billing", "settings"] as const,
    feeItems: () => ["billing", "fee-items"] as const,
    structures: (yearId: string) => ["billing", "structures", yearId] as const,
    discounts: () => ["billing", "discounts"] as const,
    invoices: (query: object = {}) => ["billing", "invoices", query] as const,
    invoice: (id: string) => ["billing", "invoice", id] as const,
    payments: (familyId = "") => ["billing", "payments", familyId] as const,
    statements: () => ["billing", "statements"] as const,
    families: () => ["billing", "families"] as const,
    collections: (range: { from: string; to: string }) =>
      ["billing", "collections", range] as const,
    outstanding: (gradeLevelId = "") =>
      ["billing", "outstanding", gradeLevelId] as const,
  },

  /** Every admissions query: one invalidation after any change refreshes the board and the family's view. */
  admissions: {
    all: () => ["admissions"] as const,
    publicPage: () => ["admissions", "public"] as const,
    mine: () => ["admissions", "mine"] as const,
    myApplication: (id: string) => ["admissions", "mine", id] as const,
    cycles: () => ["admissions", "cycles"] as const,
    places: (id: string) => ["admissions", "places", id] as const,
    forms: () => ["admissions", "forms"] as const,
    stages: () => ["admissions", "stages"] as const,
    applications: (query: object) =>
      ["admissions", "applications", query] as const,
    application: (id: string) => ["admissions", "application", id] as const,
    reEnrolments: (yearId: string) =>
      ["admissions", "re-enrolments", yearId] as const,
    myReEnrolments: () => ["admissions", "re-enrolments", "mine"] as const,
  },
};
