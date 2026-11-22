import type { Role } from "@/common/auth/roles";
import type { ApiResponse } from "@/common/types/api";
import type {
  Invitation,
  InvitationDetails,
  Member,
} from "@/common/types/identity";

export interface IMembersService {
  list: (schoolId: string) => ApiResponse<{ members: Member[]; total: number }>;
  invite: (input: {
    schoolId: string;
    email: string;
    roles: Role[];
  }) => ApiResponse<Invitation>;
  listInvitations: (schoolId: string) => ApiResponse<Invitation[]>;
  cancelInvitation: (invitationId: string) => ApiResponse<unknown>;
  updateRoles: (input: {
    schoolId: string;
    memberId: string;
    roles: Role[];
  }) => ApiResponse<unknown>;
  remove: (input: {
    schoolId: string;
    memberId: string;
  }) => ApiResponse<unknown>;
  getInvitation: (id: string) => ApiResponse<InvitationDetails>;
  acceptInvitation: (invitationId: string) => ApiResponse<unknown>;
  rejectInvitation: (invitationId: string) => ApiResponse<unknown>;
  /** Makes a school the session's active school, for hosts without a school subdomain. */
  setActiveSchool: (schoolId: string) => ApiResponse<unknown>;
}
