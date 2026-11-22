import {
  AwardIcon,
  BookOpenCheckIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderHeartIcon,
  GraduationCapIcon,
  type LucideIcon,
  MegaphoneIcon,
  NotebookPenIcon,
  ReceiptTextIcon,
  SettingsIcon,
  SunIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { Role } from "@/common/auth/roles";
import type messages from "@/common/i18n/messages/en.json";

type NavLabel = Exclude<
  keyof (typeof messages)["nav"],
  "label" | "sections" | "toggleSidebar"
>;
type NavSectionLabel = keyof (typeof messages)["nav"]["sections"];

export interface NavItem {
  label: NavLabel;
  href: string;
  icon: LucideIcon;
  roles: readonly Role[];
}

export interface NavSection {
  label?: NavSectionLabel;
  items: NavItem[];
}

const STAFF: Role[] = ["admin", "coordinator", "teacher", "teaching_assistant"];
const SCHOOL_COMMUNITY: Role[] = [
  ...STAFF,
  "admissions_officer",
  "finance_officer",
  "class_member",
  "student",
  "guardian",
];

export const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: "today", href: "/", icon: SunIcon, roles: SCHOOL_COMMUNITY },
      {
        label: "timetable",
        href: "/timetable",
        icon: CalendarClockIcon,
        roles: [...STAFF, "class_member", "student", "guardian"],
      },
      {
        label: "calendar",
        href: "/calendar",
        icon: CalendarDaysIcon,
        roles: SCHOOL_COMMUNITY,
      },
      {
        label: "announcements",
        href: "/announcements",
        icon: MegaphoneIcon,
        roles: SCHOOL_COMMUNITY,
      },
    ],
  },
  {
    label: "teaching",
    items: [
      {
        label: "classes",
        href: "/classes",
        icon: GraduationCapIcon,
        roles: [...STAFF, "class_member"],
      },
      {
        label: "gradebook",
        href: "/gradebook",
        icon: BookOpenCheckIcon,
        roles: ["coordinator", "teacher", "teaching_assistant"],
      },
      {
        label: "grades",
        href: "/grades",
        icon: AwardIcon,
        roles: ["student", "guardian"],
      },
      {
        label: "portfolio",
        href: "/portfolio",
        icon: FolderHeartIcon,
        roles: ["student", "guardian"],
      },
      {
        label: "attendance",
        href: "/attendance",
        icon: ClipboardCheckIcon,
        roles: STAFF,
      },
      {
        label: "planning",
        href: "/planning",
        icon: NotebookPenIcon,
        roles: [...STAFF, "class_member"],
      },
    ],
  },
  {
    label: "students",
    items: [
      { label: "students", href: "/students", icon: UsersIcon, roles: STAFF },
      { label: "reports", href: "/reports", icon: FileTextIcon, roles: STAFF },
    ],
  },
  {
    label: "school",
    items: [
      {
        label: "admissions",
        href: "/admissions",
        icon: UserPlusIcon,
        roles: [
          "admin",
          "admissions_officer",
          "coordinator",
          "finance_officer",
        ],
      },
      {
        label: "applications",
        href: "/applications",
        icon: UserPlusIcon,
        roles: ["applicant"],
      },
      {
        label: "reEnrolment",
        href: "/re-enrolment",
        icon: CalendarCheckIcon,
        roles: ["guardian"],
      },
      {
        label: "billing",
        href: "/billing",
        icon: ReceiptTextIcon,
        roles: ["admin", "finance_officer", "guardian", "applicant"],
      },
      {
        label: "settings",
        href: "/settings",
        icon: SettingsIcon,
        roles: ["admin"],
      },
    ],
  },
];

/** A user with several roles sees the union of what each role can reach. */
export function navigationFor(roles: readonly Role[]): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.roles.some((role) => roles.includes(role)),
    ),
  })).filter((section) => section.items.length > 0);
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
