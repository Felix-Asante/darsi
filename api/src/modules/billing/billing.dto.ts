import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.js';
import {
  FEE_KINDS,
  type FeeKind,
  PAYMENT_METHODS,
  type PaymentMethod,
  SCHEDULES,
  type Schedule,
} from './billing.entities.js';
import { ROUNDING_MODES, type RoundingMode } from './money/money.js';

/** Money travels as a string of minor units ("450000"), so no client ever rounds it through a float. */
const MINOR = /^\d{1,15}$/;

export class BillingSettingsDto {
  @IsIn(ROUNDING_MODES)
  rounding: RoundingMode;

  @Matches(/^[A-Z0-9]{1,8}$/)
  invoicePrefix: string;

  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays: number;

  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(90, { each: true })
  reminderDaysBefore: number[];

  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(180, { each: true })
  reminderDaysAfter: number[];
}

export class FeeItemDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsIn(FEE_KINDS)
  kind: FeeKind;

  @Matches(MINOR)
  amount: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  taxRateBp: number;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  accountingCode?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StructureLineDto {
  @IsUUID()
  feeItemId: string;

  @Matches(MINOR)
  amount: string;
}

export class FeeStructureDto {
  @IsUUID()
  academicYearId: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsIn(SCHEDULES)
  schedule: Schedule;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => StructureLineDto)
  lines: StructureLineDto[];
}

export class DiscountDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsIn(['percent', 'fixed'])
  kind: 'percent' | 'fixed';

  /** Basis points for percentages (1000 = 10%), minor units for fixed amounts. */
  @Matches(MINOR)
  value: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  feeItemIds: string[];
}

export class StudentDiscountsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  discountIds: string[];
}

export class RunPeriodDto {
  @IsUUID()
  academicYearId: string;

  @IsIn(SCHEDULES)
  schedule: Schedule;

  /** The term, for termly structures. */
  @IsOptional()
  @IsUUID()
  termId?: string;

  /** `2026-10`, for monthly structures. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @IsOptional()
  @IsCalendarDate()
  dueDate?: string;
}

export class InvoiceLineDto {
  @IsOptional()
  @IsUUID()
  studentId?: string | null;

  @IsOptional()
  @IsUUID()
  feeItemId?: string | null;

  @IsString()
  @Length(1, 200)
  description: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @Matches(MINOR)
  unitAmount: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  taxRateBp: number;
}

export class DraftInvoiceDto {
  @IsUUID()
  familyId: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}

export class IssueInvoiceDto {
  @IsOptional()
  @IsCalendarDate()
  dueDate?: string;
}

export class CreditNoteDto {
  @Matches(MINOR)
  amount: string;

  @IsString()
  @Length(1, 500)
  reason: string;
}

export class PaymentDto {
  @IsUUID()
  familyId: string;

  @Matches(MINOR)
  amount: string;

  @IsIn(PAYMENT_METHODS.filter((method) => method !== 'card'))
  method: Exclude<PaymentMethod, 'card'>;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  reference?: string | null;

  @IsCalendarDate()
  receivedOn: string;

  /** Pay this invoice only; otherwise oldest first (FEE-13). */
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}

export class RefundDto {
  @Matches(MINOR)
  amount: string;

  @IsString()
  @Length(1, 500)
  reason: string;
}

export class LocaleQueryDto {
  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';
}

export class ReportRangeDto {
  @IsCalendarDate()
  from: string;

  @IsCalendarDate()
  to: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;
}
