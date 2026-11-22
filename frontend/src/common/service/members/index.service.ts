import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IMembersService } from "./interface";

export function createMembersService(http: HttpClient): IMembersService {
  const { members } = apiEndpoints;
  return {
    list: (schoolId) => http.get(members.list(schoolId)),
    invite: ({ schoolId, email, roles }) =>
      http.post(members.invite(), {
        organizationId: schoolId,
        email,
        role: roles,
      }),
    listInvitations: (schoolId) => http.get(members.invitations(schoolId)),
    cancelInvitation: (invitationId) =>
      http.post(members.cancelInvitation(), { invitationId }),
    updateRoles: ({ schoolId, memberId, roles }) =>
      http.post(members.updateRole(), {
        organizationId: schoolId,
        memberId,
        role: roles,
      }),
    remove: ({ schoolId, memberId }) =>
      http.post(members.remove(), {
        organizationId: schoolId,
        memberIdOrEmail: memberId,
      }),
    getInvitation: (id) =>
      http.get(members.invitation(id), undefined, { isRetryable: false }),
    acceptInvitation: (invitationId) =>
      http.post(members.acceptInvitation(), { invitationId }),
    rejectInvitation: (invitationId) =>
      http.post(members.rejectInvitation(), { invitationId }),
    setActiveSchool: (schoolId) =>
      http.post(members.setActiveSchool(), { organizationId: schoolId }),
  };
}
