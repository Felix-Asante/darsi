import type { Role } from "@/common/auth/roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  locale?: string | null;
}

export interface Session {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: string;
    activeOrganizationId?: string | null;
  };
}

export interface School {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  defaultLocale: "en" | "fr";
  timeZone: string;
  currency: string;
  onboardingCompleted: boolean;
}

export interface SchoolMembership {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  roles: Role[];
}

export interface Me {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    locale: string | null;
  };
  schools: SchoolMembership[];
  currentSchool: (School & { roles: Role[] }) | null;
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  expiresAt: string;
  inviterId: string;
}

export interface InvitationDetails extends Invitation {
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
}

export interface SchoolSettingsInput {
  name: string;
  defaultLocale: "en" | "fr";
  timeZone: string;
  currency: string;
}

export interface AppNotification {
  id: string;
  type: string;
  params: Record<string, string | number | boolean | null>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
