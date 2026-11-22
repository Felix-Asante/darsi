import { env } from "@/common/config/env";
import type { CursorQuery, Query } from "@/common/types/api";
import { toQueryParams } from "@/common/utils/query-params";

const API_BASE_URL = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");

/** Business endpoints, versioned under `/api/v1`. */
const v1 = (path: string) => `${API_BASE_URL}/api/v1${path}`;

/** Better Auth's endpoints: sessions, passwords, schools' members and invitations. */
const auth = (path: string) => `${API_BASE_URL}/api/auth${path}`;

/** Platform endpoints that live outside the versioned API. */
const platform = (path: string) => `${API_BASE_URL}${path}`;

export const healthEndpoints = {
  ready: () => platform("/health/ready"),
};

export const authEndpoints = {
  session: () => auth("/get-session"),
  signIn: () => auth("/sign-in/email"),
  signInSocial: () => auth("/sign-in/social"),
  signUp: () => auth("/sign-up/email"),
  signOut: () => auth("/sign-out"),
  sendVerificationEmail: () => auth("/send-verification-email"),
  requestPasswordReset: () => auth("/request-password-reset"),
  resetPassword: () => auth("/reset-password"),
};

export const membersEndpoints = {
  list: (organizationId: string) =>
    auth(
      `/organization/list-members${toQueryParams({ organizationId, limit: 500 })}`,
    ),
  invite: () => auth("/organization/invite-member"),
  invitations: (organizationId: string) =>
    auth(`/organization/list-invitations${toQueryParams({ organizationId })}`),
  cancelInvitation: () => auth("/organization/cancel-invitation"),
  updateRole: () => auth("/organization/update-member-role"),
  remove: () => auth("/organization/remove-member"),
  invitation: (id: string) =>
    auth(`/organization/get-invitation${toQueryParams({ id })}`),
  acceptInvitation: () => auth("/organization/accept-invitation"),
  rejectInvitation: () => auth("/organization/reject-invitation"),
  setActiveSchool: () => auth("/organization/set-active"),
};

export const meEndpoints = {
  get: () => v1("/me"),
};

export const schoolEndpoints = {
  current: () => v1("/schools/current"),
  onboarding: () => v1("/schools/current/onboarding"),
};

export const notificationsEndpoints = {
  list: (query: CursorQuery = {}) =>
    v1(`/notifications${toQueryParams(query)}`),
  unreadCount: () => v1("/notifications/unread-count"),
  markRead: () => v1("/notifications/read"),
  markAllRead: () => v1("/notifications/read-all"),
  preferences: () => v1("/notifications/preferences"),
};

export const academicsEndpoints = {
  years: () => v1("/academics/years"),
  year: (id: string) => v1(`/academics/years/${id}`),
  makeCurrent: (id: string) => v1(`/academics/years/${id}/make-current`),
  divisions: () => v1("/academics/divisions"),
  division: (id: string) => v1(`/academics/divisions/${id}`),
  gradeLevels: () => v1("/academics/grade-levels"),
  gradeLevel: (id: string) => v1(`/academics/grade-levels/${id}`),
  subjects: () => v1("/academics/subjects"),
  subject: (id: string) => v1(`/academics/subjects/${id}`),
  classes: (query: Query = {}) =>
    v1(`/academics/classes${toQueryParams(query)}`),
  class: (id: string) => v1(`/academics/classes/${id}`),
  classStaff: (id: string) => v1(`/academics/classes/${id}/staff`),
  roster: (id: string) => v1(`/academics/classes/${id}/students`),
  enrolment: (classId: string, studentId: string) =>
    v1(`/academics/classes/${classId}/students/${studentId}`),
  terms: (yearId: string) => v1(`/academics/years/${yearId}/terms`),
  term: (id: string) => v1(`/academics/terms/${id}`),
};

export const peopleEndpoints = {
  students: (query: Query = {}) => v1(`/students${toQueryParams(query)}`),
  mine: () => v1("/students/mine"),
  student: (id: string) => v1(`/students/${id}`),
  studentGuardians: (id: string) => v1(`/students/${id}/guardians`),
  studentGuardian: (id: string, guardianId: string) =>
    v1(`/students/${id}/guardians/${guardianId}`),
  guardians: (query: Query = {}) => v1(`/guardians${toQueryParams(query)}`),
  guardian: (id: string) => v1(`/guardians/${id}`),
};

export const curriculumEndpoints = {
  frameworks: () => v1("/curriculum/frameworks"),
  framework: (id: string) => v1(`/curriculum/frameworks/${id}`),
  standards: (frameworkId: string) =>
    v1(`/curriculum/frameworks/${frameworkId}/standards`),
};

export const importsEndpoints = {
  list: () => v1("/imports"),
  columns: () => v1("/imports/columns"),
  job: (id: string) => v1(`/imports/${id}`),
};

type DateRange = { from: string; to: string };

export const calendarEndpoints = {
  items: (range: DateRange) => v1(`/calendar${toQueryParams(range)}`),
  events: () => v1("/calendar/events"),
  event: (id: string) => v1(`/calendar/events/${id}`),
};

export const timetablesEndpoints = {
  mine: (range: DateRange) => v1(`/timetables/me${toQueryParams(range)}`),
  student: (studentId: string, range: DateRange) =>
    v1(`/timetables/students/${studentId}${toQueryParams(range)}`),
  classSlots: (classId: string) => v1(`/timetables/classes/${classId}/slots`),
  classSlot: (classId: string, slotId: string) =>
    v1(`/timetables/classes/${classId}/slots/${slotId}`),
  schedules: () => v1("/timetables/bell-schedules"),
  schedule: (id: string) => v1(`/timetables/bell-schedules/${id}`),
  periods: (scheduleId: string) =>
    v1(`/timetables/bell-schedules/${scheduleId}/periods`),
  period: (id: string) => v1(`/timetables/periods/${id}`),
};

export const gradingEndpoints = {
  presets: () => v1("/grading/presets"),
  scales: () => v1("/grading/scales"),
  scale: (id: string) => v1(`/grading/scales/${id}`),
  conversions: () => v1("/grading/conversions"),
  convert: () => v1("/grading/convert"),
  policies: () => v1("/grading/policies"),
};

export const assessmentEndpoints = {
  forClass: (classId: string) =>
    v1(`/assessment/classes/${classId}/assessments`),
  gradebook: (classId: string, termId?: string) =>
    v1(`/assessment/classes/${classId}/gradebook${toQueryParams({ termId })}`),
  studentGrades: (studentId: string, termId?: string) =>
    v1(`/assessment/students/${studentId}/grades${toQueryParams({ termId })}`),
  one: (id: string) => v1(`/assessment/assessments/${id}`),
  grades: (id: string) => v1(`/assessment/assessments/${id}/grades`),
  publish: (id: string) => v1(`/assessment/assessments/${id}/publish`),
  submission: (id: string) => v1(`/assessment/assessments/${id}/submission`),
};

export const attendanceEndpoints = {
  settings: () => v1("/attendance/settings"),
  statuses: () => v1("/attendance/statuses"),
  status: (code: string) =>
    v1(`/attendance/statuses/${encodeURIComponent(code)}`),
  sheet: (classId: string, query: Query = {}) =>
    v1(`/attendance/classes/${classId}${toQueryParams(query)}`),
  summary: (studentId: string, range: DateRange) =>
    v1(`/attendance/students/${studentId}/summary${toQueryParams(range)}`),
  reasons: (studentId: string) =>
    v1(`/attendance/students/${studentId}/reasons`),
  report: (query: Query) => v1(`/attendance/report${toQueryParams(query)}`),
  reportCsv: (query: Query) =>
    v1(`/attendance/report.csv${toQueryParams(query)}`),
};

export const announcementsEndpoints = {
  feed: (cursor?: string) => v1(`/announcements${toQueryParams({ cursor })}`),
  scheduled: () => v1("/announcements/scheduled"),
  one: (id: string) => v1(`/announcements/${id}`),
  classSettings: (classId: string) =>
    v1(`/announcements/classes/${classId}/settings`),
};

export const planningEndpoints = {
  templates: () => v1("/planning/templates"),
  template: (id: string) => v1(`/planning/templates/${id}`),
  units: () => v1("/planning/units"),
  forClass: (classId: string) => v1(`/planning/classes/${classId}/units`),
  unit: (id: string) => v1(`/planning/units/${id}`),
  collaborators: (id: string) => v1(`/planning/units/${id}/collaborators`),
  assessments: (id: string) => v1(`/planning/units/${id}/assessments`),
  copy: (id: string) => v1(`/planning/units/${id}/copy`),
  lessons: (unitId: string) => v1(`/planning/units/${unitId}/lessons`),
  lesson: (unitId: string, lessonId: string) =>
    v1(`/planning/units/${unitId}/lessons/${lessonId}`),
};

export const filesEndpoints = {
  uploads: () => v1("/files/uploads"),
  complete: (id: string) => v1(`/files/${id}/complete`),
  download: (id: string, inline?: boolean) =>
    v1(
      `/files/${id}/download${toQueryParams({ inline: inline ? "true" : undefined })}`,
    ),
  usage: () => v1("/files/usage"),
  studentFiles: (studentId: string) => v1(`/students/${studentId}/files`),
  studentFile: (id: string) => v1(`/student-files/${id}`),
};

export const driveEndpoints = {
  list: (classId: string, folderId?: string) =>
    v1(`/drive/classes/${classId}${toQueryParams({ folderId })}`),
  folders: (classId: string) => v1(`/drive/classes/${classId}/folders`),
  item: (id: string) => v1(`/drive/items/${id}`),
  attachments: (query: Query = {}) =>
    v1(`/drive/attachments${toQueryParams(query)}`),
};

export const portfolioEndpoints = {
  overview: (studentId: string) => v1(`/portfolio/students/${studentId}`),
  items: (studentId: string, cursor?: string) =>
    v1(`/portfolio/students/${studentId}/items${toQueryParams({ cursor })}`),
  classItems: (classId: string, cursor?: string) =>
    v1(`/portfolio/classes/${classId}/items${toQueryParams({ cursor })}`),
  add: () => v1("/portfolio/items"),
  item: (id: string) => v1(`/portfolio/items/${id}`),
  approve: (id: string) => v1(`/portfolio/items/${id}/approve`),
  comments: (id: string) => v1(`/portfolio/items/${id}/comments`),
  settings: () => v1("/portfolio/settings"),
};

export const reportsEndpoints = {
  templates: () => v1("/reports/templates"),
  open: (termId: string) => v1(`/reports/terms/${termId}/open`),
  cards: (termId: string) => v1(`/reports/terms/${termId}/cards`),
  classSheet: (termId: string, classId: string) =>
    v1(`/reports/terms/${termId}/classes/${classId}`),
  card: (id: string) => v1(`/reports/cards/${id}`),
  generalComment: (id: string) => v1(`/reports/cards/${id}/general-comment`),
  returnForEdits: (id: string) => v1(`/reports/cards/${id}/return`),
  approve: (id: string) => v1(`/reports/cards/${id}/approve`),
};

export const billingEndpoints = {
  settings: () => v1("/billing/settings"),
  connectStripe: (locale: string) =>
    v1(`/billing/stripe/connect${toQueryParams({ locale })}`),
  feeItems: () => v1("/billing/fee-items"),
  feeItem: (id: string) => v1(`/billing/fee-items/${id}`),
  structures: (academicYearId?: string) =>
    v1(`/billing/structures${toQueryParams({ academicYearId })}`),
  discounts: () => v1("/billing/discounts"),
  discount: (id: string) => v1(`/billing/discounts/${id}`),
  studentDiscounts: (studentId: string) =>
    v1(`/billing/students/${studentId}/discounts`),
  invoices: (query: Query = {}) =>
    v1(`/billing/invoices${toQueryParams(query)}`),
  invoice: (id: string) => v1(`/billing/invoices/${id}`),
  issue: (id: string) => v1(`/billing/invoices/${id}/issue`),
  creditNotes: (id: string) => v1(`/billing/invoices/${id}/credit-notes`),
  checkout: (id: string, locale: string) =>
    v1(`/billing/invoices/${id}/checkout${toQueryParams({ locale })}`),
  pdf: (path: "invoice" | "receipt", id: string, locale: string) =>
    v1(
      `/billing/${path === "invoice" ? "invoices" : "payments"}/${id}/${path === "invoice" ? "pdf" : "receipt"}${toQueryParams({ locale })}`,
    ),
  previewRun: () => v1("/billing/runs/preview"),
  runs: () => v1("/billing/runs"),
  payments: (familyId?: string) =>
    v1(`/billing/payments${toQueryParams({ familyId })}`),
  refunds: (paymentId: string) => v1(`/billing/payments/${paymentId}/refunds`),
  statements: () => v1("/billing/statements"),
  families: () => v1("/billing/families"),
  outstanding: (gradeLevelId?: string) =>
    v1(`/billing/reports/outstanding${toQueryParams({ gradeLevelId })}`),
  outstandingCsv: (gradeLevelId?: string) =>
    v1(`/billing/reports/outstanding.csv${toQueryParams({ gradeLevelId })}`),
  collections: (range: DateRange) =>
    v1(`/billing/reports/collections${toQueryParams(range)}`),
};

export const admissionsEndpoints = {
  publicPage: () => v1("/admissions/public"),
  join: () => v1("/admissions/join"),
  myApplications: () => v1("/admissions/my-applications"),
  myApplication: (id: string) => v1(`/admissions/my-applications/${id}`),
  document: (id: string, key: string) =>
    v1(`/admissions/my-applications/${id}/documents/${key}`),
  submit: (id: string) => v1(`/admissions/my-applications/${id}/submit`),
  offer: (id: string) => v1(`/admissions/my-applications/${id}/offer`),
  cycles: () => v1("/admissions/cycles"),
  cycle: (id: string) => v1(`/admissions/cycles/${id}`),
  places: (id: string) => v1(`/admissions/cycles/${id}/places`),
  forms: () => v1("/admissions/forms"),
  stages: () => v1("/admissions/stages"),
  applications: (query: Query = {}) =>
    v1(`/admissions/applications${toQueryParams(query)}`),
  application: (id: string) => v1(`/admissions/applications/${id}`),
  move: (id: string) => v1(`/admissions/applications/${id}/move`),
  notes: (id: string) => v1(`/admissions/applications/${id}/notes`),
  reEnrolments: (academicYearId?: string) =>
    v1(`/admissions/re-enrolments${toQueryParams({ academicYearId })}`),
  applyReEnrolment: () => v1("/admissions/re-enrolments/apply"),
  myReEnrolments: () => v1("/admissions/re-enrolments/mine"),
  respondReEnrolment: (id: string) =>
    v1(`/admissions/re-enrolments/${id}/respond`),
  withdrawal: (studentId: string) =>
    v1(`/admissions/students/${studentId}/withdrawal`),
};

export const apiEndpoints = {
  v1,
  health: healthEndpoints,
  auth: authEndpoints,
  members: membersEndpoints,
  me: meEndpoints,
  school: schoolEndpoints,
  notifications: notificationsEndpoints,
  academics: academicsEndpoints,
  people: peopleEndpoints,
  curriculum: curriculumEndpoints,
  imports: importsEndpoints,
  calendar: calendarEndpoints,
  timetables: timetablesEndpoints,
  grading: gradingEndpoints,
  assessment: assessmentEndpoints,
  attendance: attendanceEndpoints,
  announcements: announcementsEndpoints,
  planning: planningEndpoints,
  files: filesEndpoints,
  drive: driveEndpoints,
  portfolio: portfolioEndpoints,
  reports: reportsEndpoints,
  billing: billingEndpoints,
  admissions: admissionsEndpoints,
};
