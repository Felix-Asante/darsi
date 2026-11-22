/** Published after someone joins a school, so other modules can link their records to the account. */
export const MEMBER_ADDED = 'member.added';

export interface MemberAddedEvent {
  schoolId: string;
  userId: string;
  email: string;
}
