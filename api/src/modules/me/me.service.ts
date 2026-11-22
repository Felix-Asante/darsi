import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { parseRoles, type Role } from '../auth/access-control.js';
import { Member } from '../auth/entities/member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { type SchoolView, SchoolsService } from '../schools/schools.service.js';

export interface MeView {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    locale: string | null;
  };
  schools: {
    id: string;
    slug: string;
    name: string;
    logo: string | null;
    roles: Role[];
  }[];
  currentSchool: (SchoolView & { roles: Role[] }) | null;
}

@Injectable()
export class MeService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly schools: SchoolsService,
  ) {}

  async get(): Promise<MeView> {
    const userId = this.context.requireUserId();
    const user = await this.txHost.tx.findOneBy(User, { id: userId });
    if (!user) throw new NotFoundException();

    const memberships = await this.txHost.tx.find(Member, {
      where: { userId },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        locale: user.locale,
      },
      schools: memberships.map((member) => ({
        id: member.organizationId,
        slug: member.organization!.slug,
        name: member.organization!.name,
        logo: member.organization!.logo,
        roles: parseRoles(member.role),
      })),
      currentSchool: this.context.schoolId
        ? { ...(await this.schools.getCurrent()), roles: this.context.roles }
        : null,
    };
  }
}
