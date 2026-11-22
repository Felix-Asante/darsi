import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { AcademicsService } from '../academics/academics.service.js';
import { PeopleService } from '../people/people.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import type {
  BillingSettingsDto,
  DiscountDto,
  FeeItemDto,
  FeeStructureDto,
} from './billing.dto.js';
import {
  BillingSettings,
  Discount,
  FeeItem,
  FeeStructure,
  FeeStructureLine,
  StudentDiscount,
} from './billing.entities.js';

export interface SettingsValues {
  currency: string;
  rounding: BillingSettings['rounding'];
  invoicePrefix: string;
  paymentTermsDays: number;
  reminderDaysBefore: number[];
  reminderDaysAfter: number[];
  stripeAccountId: string | null;
}

const DEFAULTS: Omit<SettingsValues, 'currency'> = {
  rounding: 'half_up',
  invoicePrefix: 'INV',
  paymentTermsDays: 30,
  reminderDaysBefore: [7],
  reminderDaysAfter: [7, 30],
  stripeAccountId: null,
};

/** Money as it leaves the API: strings of minor units, never numbers. */
export const minorString = (value: bigint) => value.toString();

/** Fee items, structures and discounts (FEE-2/3/4). */
@Injectable()
export class BillingSetupService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly academics: AcademicsService,
    private readonly schools: SchoolsService,
    private readonly people: PeopleService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  async settings() {
    const row = await this.tx.findOneBy(BillingSettings, {});
    const { currency } = await this.schools.getCurrent();
    const settings: Omit<SettingsValues, 'currency'> = row ?? DEFAULTS;
    return {
      currency,
      rounding: settings.rounding,
      invoicePrefix: settings.invoicePrefix,
      paymentTermsDays: settings.paymentTermsDays,
      reminderDaysBefore: settings.reminderDaysBefore,
      reminderDaysAfter: settings.reminderDaysAfter,
      stripeConnected: Boolean(settings.stripeAccountId),
    };
  }

  /** For services: the stored row with its Stripe account. */
  async settingsRow(): Promise<SettingsValues> {
    const row = await this.tx.findOneBy(BillingSettings, {});
    const { currency } = await this.schools.getCurrent();
    const settings: Omit<SettingsValues, 'currency'> = row ?? DEFAULTS;
    return {
      currency,
      rounding: settings.rounding,
      invoicePrefix: settings.invoicePrefix,
      paymentTermsDays: settings.paymentTermsDays,
      reminderDaysBefore: settings.reminderDaysBefore,
      reminderDaysAfter: settings.reminderDaysAfter,
      stripeAccountId: settings.stripeAccountId,
    };
  }

  async saveSettings(dto: BillingSettingsDto) {
    const row =
      (await this.tx.findOneBy(BillingSettings, {})) ??
      this.tx.create(BillingSettings, { stripeAccountId: null });
    await this.tx.save(
      Object.assign(row, {
        rounding: dto.rounding,
        invoicePrefix: dto.invoicePrefix,
        paymentTermsDays: dto.paymentTermsDays,
        reminderDaysBefore: [...new Set(dto.reminderDaysBefore)].sort(
          (a, b) => b - a,
        ),
        reminderDaysAfter: [...new Set(dto.reminderDaysAfter)].sort(
          (a, b) => a - b,
        ),
      }),
    );
    return this.settings();
  }

  async connectStripe(accountId: string) {
    const row =
      (await this.tx.findOneBy(BillingSettings, {})) ??
      this.tx.create(BillingSettings, { ...DEFAULTS });
    await this.tx.save(Object.assign(row, { stripeAccountId: accountId }));
  }

  // ── Fee items ───────────────────────────────────────────────────────

  async feeItems() {
    const items = await this.tx.find(FeeItem, { order: { name: 'ASC' } });
    return items.map(feeItemView);
  }

  async findFeeItem(id: string): Promise<FeeItem | null> {
    return this.tx.findOneBy(FeeItem, { id });
  }

  async saveFeeItem(dto: FeeItemDto, id?: string) {
    const { currency } = await this.schools.getCurrent();
    const item = id
      ? await this.tx.findOneBy(FeeItem, { id })
      : this.tx.create(FeeItem, { currency });
    if (!item) throw new NotFoundException();
    await this.tx.save(
      Object.assign(item, {
        name: dto.name,
        kind: dto.kind,
        amount: BigInt(dto.amount),
        taxRateBp: dto.taxRateBp,
        accountingCode: dto.accountingCode || null,
        active: dto.active ?? true,
      }),
    );
    return feeItemView(item);
  }

  // ── Structures ──────────────────────────────────────────────────────

  async structures(academicYearId?: string) {
    const structures = await this.tx.find(FeeStructure, {
      where: academicYearId ? { academicYearId } : {},
      order: { name: 'ASC' },
    });
    const lines = structures.length
      ? await this.tx.findBy(FeeStructureLine, {
          structureId: In(structures.map((s) => s.id)),
        })
      : [];
    return structures.map((structure) => ({
      id: structure.id,
      academicYearId: structure.academicYearId,
      gradeLevelId: structure.gradeLevelId,
      name: structure.name,
      schedule: structure.schedule,
      lines: lines
        .filter((line) => line.structureId === structure.id)
        .map((line) => ({
          feeItemId: line.feeItemId,
          amount: minorString(line.amount),
        })),
    }));
  }

  async saveStructure(dto: FeeStructureDto) {
    await this.academics.findYear(dto.academicYearId);
    if (dto.gradeLevelId) await this.academics.findGradeLevel(dto.gradeLevelId);
    const items = await this.tx.findBy(FeeItem, {
      id: In(dto.lines.map((line) => line.feeItemId)),
    });
    if (
      items.length !== new Set(dto.lines.map((line) => line.feeItemId)).size
    ) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'lines', codes: ['notFound'] }],
      );
    }
    const structure =
      (await this.tx.findOneBy(FeeStructure, {
        academicYearId: dto.academicYearId,
        gradeLevelId: dto.gradeLevelId ?? IsNull(),
      })) ??
      this.tx.create(FeeStructure, {
        academicYearId: dto.academicYearId,
        gradeLevelId: dto.gradeLevelId ?? null,
      });
    await this.tx.save(
      Object.assign(structure, { name: dto.name, schedule: dto.schedule }),
    );
    await this.tx.delete(FeeStructureLine, { structureId: structure.id });
    for (const line of dto.lines) {
      await this.tx.save(
        this.tx.create(FeeStructureLine, {
          structureId: structure.id,
          feeItemId: line.feeItemId,
          amount: BigInt(line.amount),
        }),
      );
    }
    return (await this.structures(dto.academicYearId)).find(
      (entry) => entry.id === structure.id,
    )!;
  }

  // ── Discounts ───────────────────────────────────────────────────────

  async discounts() {
    const discounts = await this.tx.find(Discount, { order: { name: 'ASC' } });
    const assigned = await this.tx.find(StudentDiscount);
    return discounts.map((discount) => ({
      id: discount.id,
      name: discount.name,
      kind: discount.kind,
      value: minorString(discount.value),
      feeItemIds: discount.feeItemIds,
      studentIds: assigned
        .filter((entry) => entry.discountId === discount.id)
        .map((entry) => entry.studentId),
    }));
  }

  async saveDiscount(dto: DiscountDto, id?: string) {
    if (dto.kind === 'percent' && BigInt(dto.value) > 10_000n) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'value', codes: ['max'] }],
      );
    }
    const discount = id
      ? await this.tx.findOneBy(Discount, { id })
      : this.tx.create(Discount, {});
    if (!discount) throw new NotFoundException();
    await this.tx.save(
      Object.assign(discount, {
        name: dto.name,
        kind: dto.kind,
        value: BigInt(dto.value),
        feeItemIds: [...new Set(dto.feeItemIds)],
      }),
    );
    return (await this.discounts()).find((entry) => entry.id === discount.id)!;
  }

  /** A student's discounts and scholarships, replaced as a set (FEE-4). */
  async setStudentDiscounts(studentId: string, discountIds: string[]) {
    if ((await this.people.studentsByIds([studentId])).length === 0)
      throw new NotFoundException();
    const found = discountIds.length
      ? await this.tx.countBy(Discount, { id: In(discountIds) })
      : 0;
    if (found !== new Set(discountIds).size) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'discountIds', codes: ['notFound'] }],
      );
    }
    await this.tx.delete(StudentDiscount, { studentId });
    for (const discountId of new Set(discountIds))
      await this.tx.save(
        this.tx.create(StudentDiscount, { studentId, discountId }),
      );
  }

  /** Everything a bulk run needs, read once. */
  async runInputs(academicYearId: string) {
    const [structures, items, discounts, assigned] = await Promise.all([
      this.tx.findBy(FeeStructure, { academicYearId }),
      this.tx.find(FeeItem),
      this.tx.find(Discount),
      this.tx.find(StudentDiscount),
    ]);
    const lines = structures.length
      ? await this.tx.findBy(FeeStructureLine, {
          structureId: In(structures.map((s) => s.id)),
        })
      : [];
    return { structures, lines, items, discounts, assigned };
  }
}

const feeItemView = (item: FeeItem) => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  amount: minorString(item.amount),
  currency: item.currency,
  taxRateBp: item.taxRateBp,
  accountingCode: item.accountingCode,
  active: item.active,
});
