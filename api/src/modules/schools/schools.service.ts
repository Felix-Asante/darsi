import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { IncomingHttpHeaders } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { appLink } from '../../common/http/app-links.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AuditService } from '../audit/audit.service.js';
import { AUTH, type Auth } from '../auth/auth.factory.js';
import { Organization } from '../auth/entities/organization.entity.js';
import type {
  CompleteOnboardingDto,
  CreateSchoolDto,
  UpdateSchoolDto,
} from './dto/school-settings.dto.js';
import { School } from './school.entity.js';

export interface SchoolView {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  defaultLocale: string;
  timeZone: string;
  currency: string;
  onboardingCompleted: boolean;
}

const settingsOf = (school: School) => ({
  defaultLocale: school.defaultLocale,
  timeZone: school.timeZone,
  currency: school.currency,
});

@Injectable()
export class SchoolsService {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly transactions: TenantTransactions,
    private readonly context: RequestContext,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** For public pages, which have no session: organizations are global, so no school context is needed. */
  async idForSlug(slug: string): Promise<string | null> {
    const organization = await this.txHost.tx.findOneBy(Organization, {
      slug: slug.toLowerCase(),
    });
    return organization?.id ?? null;
  }

  async getCurrent(): Promise<SchoolView> {
    const schoolId = this.context.requireSchoolId();
    const [organization, school] = await Promise.all([
      this.txHost.tx.findOneBy(Organization, { id: schoolId }),
      this.txHost.tx.findOneBy(School, { schoolId }),
    ]);
    if (!organization || !school) throw new NotFoundException();
    return this.toView(organization, school);
  }

  async update(
    dto: UpdateSchoolDto,
    headers: IncomingHttpHeaders,
  ): Promise<SchoolView> {
    return this.applyChanges(dto, headers, false);
  }

  async completeOnboarding(
    dto: CompleteOnboardingDto,
    headers: IncomingHttpHeaders,
  ): Promise<SchoolView> {
    return this.applyChanges(dto, headers, true);
  }

  /** Creates a school and its first administrator, who receives a link to choose a password. */
  async create(dto: CreateSchoolDto): Promise<SchoolView> {
    const available = await this.auth.api
      .checkOrganizationSlug({ body: { slug: dto.slug } })
      .catch(() => null);
    if (!available)
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'slug_taken',
        `"${dto.slug}" is already used`,
      );

    const auth = await this.auth.$context;
    const email = dto.adminEmail.toLowerCase();
    const existing = await auth.internalAdapter.findUserByEmail(email);
    const admin =
      existing?.user ??
      (await auth.internalAdapter.createUser(
        {
          email,
          name: dto.adminName,
          emailVerified: true,
          locale: dto.defaultLocale,
        },
        { method: 'admin' },
      ));

    const organization = await this.auth.api.createOrganization({
      body: { name: dto.name, slug: dto.slug, userId: admin.id },
    });
    if (!organization)
      throw new Error('Better Auth did not create the organization');

    const school = await this.transactions.runInSchool(
      organization.id,
      async () => {
        const created = await this.txHost.tx.save(School, {
          schoolId: organization.id,
          defaultLocale: dto.defaultLocale,
          timeZone: dto.timeZone,
          currency: dto.currency,
          hostingRegion: 'eu',
          onboardingCompletedAt: null,
        });
        await this.audit.record({
          action: 'school.created',
          entityType: 'school',
          entityId: organization.id,
          after: {
            name: dto.name,
            slug: dto.slug,
            adminEmail: email,
            ...settingsOf(created),
          },
        });
        return created;
      },
    );

    if (!existing) {
      await this.auth.api.requestPasswordReset({
        body: {
          email,
          redirectTo: appLink(
            this.config.get('APP_URL', { infer: true }),
            dto.defaultLocale,
            '/reset-password',
          ),
        },
      });
    }

    return this.toView(
      { ...organization, logo: organization.logo ?? null } as Organization,
      school,
    );
  }

  private async applyChanges(
    changes: UpdateSchoolDto,
    headers: IncomingHttpHeaders,
    completeOnboarding: boolean,
  ): Promise<SchoolView> {
    const schoolId = this.context.requireSchoolId();
    const school = await this.txHost.tx.findOneBy(School, { schoolId });
    const organization = await this.txHost.tx.findOneBy(Organization, {
      id: schoolId,
    });
    if (!school || !organization) throw new NotFoundException();

    const before = {
      name: organization.name,
      logo: organization.logo,
      ...settingsOf(school),
    };

    if (changes.name !== undefined || changes.logo !== undefined) {
      await this.auth.api.updateOrganization({
        body: {
          organizationId: schoolId,
          data: {
            ...(changes.name !== undefined && { name: changes.name }),
            ...(changes.logo !== undefined && { logo: changes.logo }),
          },
        },
        headers: fromNodeHeaders(headers),
      });
      organization.name = changes.name ?? organization.name;
      organization.logo = changes.logo ?? organization.logo;
    }

    if (changes.defaultLocale) school.defaultLocale = changes.defaultLocale;
    if (changes.timeZone) school.timeZone = changes.timeZone;
    if (changes.currency) school.currency = changes.currency;
    if (completeOnboarding) school.onboardingCompletedAt ??= new Date();
    const saved = await this.txHost.tx.save(school);

    await this.audit.record({
      action: completeOnboarding ? 'school.onboarded' : 'school.updated',
      entityType: 'school',
      entityId: schoolId,
      before,
      after: {
        name: organization.name,
        logo: organization.logo,
        ...settingsOf(saved),
      },
    });

    return this.toView(organization, saved);
  }

  private toView(organization: Organization, school: School): SchoolView {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      ...settingsOf(school),
      onboardingCompleted: school.onboardingCompletedAt !== null,
    };
  }
}
