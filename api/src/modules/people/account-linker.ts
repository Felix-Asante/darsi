import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { MEMBER_ADDED, type MemberAddedEvent } from '../auth/auth.events.js';
import { PeopleService } from './people.service.js';

/** When a guardian or student joins, their records find their account by email. */
@Injectable()
export class AccountLinker {
  constructor(
    private readonly transactions: TenantTransactions,
    private readonly people: PeopleService,
  ) {}

  @OnOutboxMessage(MEMBER_ADDED, { consumer: 'people-account-linker' })
  async link({ schoolId, userId, email }: MemberAddedEvent) {
    await this.transactions.runInSchool(schoolId, () =>
      this.people.linkAccount(userId, email),
    );
  }
}
