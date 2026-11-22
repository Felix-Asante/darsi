import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { daysBetween } from '../../common/dates/calendar-date.js';
import { AuditService } from '../audit/audit.service.js';
import { toCsv } from '../attendance/summary.js';
import { PeopleService } from '../people/people.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { BillingSetupService, minorString } from './billing-setup.service.js';
import { LedgerService } from './ledger.service.js';

export const AGING_BUCKETS = [
  'current',
  '0_30',
  '31_60',
  '61_90',
  '90_plus',
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Days past due → bucket (FEE-17). Not yet due is "current". */
export function agingBucket(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '0_30';
  if (daysPastDue <= 60) return '31_60';
  if (daysPastDue <= 90) return '61_90';
  return '90_plus';
}

@Injectable()
export class BillingReportsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly ledger: LedgerService,
    private readonly people: PeopleService,
    private readonly setup: BillingSetupService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
  ) {}

  /** What each family owes, by age of debt, optionally only families with a child in a grade. */
  async outstanding(gradeLevelId?: string) {
    const tx = this.txHost.tx;
    const today = await this.clock.today();
    const invoices = await tx.query<
      { id: string; family_id: string; due_date: string }[]
    >(
      `SELECT id, family_id, due_date::text FROM invoices WHERE status = 'issued'`,
    );
    const balances = await this.ledger.balances(
      invoices.map((invoice) => invoice.id),
    );
    const students = await this.people.billableStudents();
    const families = new Map<string, Record<AgingBucket, bigint>>();
    for (const invoice of invoices) {
      const balance = balances.get(invoice.id)!.balance;
      if (balance <= 0n) continue;
      const buckets = families.get(invoice.family_id) ?? {
        current: 0n,
        '0_30': 0n,
        '31_60': 0n,
        '61_90': 0n,
        '90_plus': 0n,
      };
      buckets[agingBucket(daysBetween(invoice.due_date, today))] += balance;
      families.set(invoice.family_id, buckets);
    }
    const names = await this.people.familyNames([...families.keys()]);
    const { currency } = await this.setup.settingsRow();
    const rows = [...families]
      .map(([familyId, buckets]) => {
        const children = students.filter(
          (student) => student.familyId === familyId,
        );
        const total = AGING_BUCKETS.reduce(
          (sum, bucket) => sum + buckets[bucket],
          0n,
        );
        return {
          familyId,
          familyName: names.get(familyId) ?? '',
          gradeLevelIds: [
            ...new Set(
              children.flatMap((student) =>
                student.gradeLevelId ? [student.gradeLevelId] : [],
              ),
            ),
          ],
          total,
          buckets,
        };
      })
      .filter(
        (row) => !gradeLevelId || row.gradeLevelIds.includes(gradeLevelId),
      )
      .sort((a, b) =>
        b.total > a.total
          ? 1
          : b.total < a.total
            ? -1
            : a.familyName.localeCompare(b.familyName),
      );
    const totals = Object.fromEntries(
      AGING_BUCKETS.map((bucket) => [
        bucket,
        minorString(rows.reduce((sum, row) => sum + row.buckets[bucket], 0n)),
      ]),
    ) as Record<AgingBucket, string>;
    return {
      currency,
      totals: {
        ...totals,
        total: minorString(rows.reduce((sum, row) => sum + row.total, 0n)),
      },
      families: rows.map((row) => ({
        familyId: row.familyId,
        familyName: row.familyName,
        gradeLevelIds: row.gradeLevelIds,
        total: minorString(row.total),
        buckets: Object.fromEntries(
          AGING_BUCKETS.map((bucket) => [
            bucket,
            minorString(row.buckets[bucket]),
          ]),
        ) as Record<AgingBucket, string>,
      })),
    };
  }

  /** Every family with what it owes and the credit it holds, for picking an account. */
  async accounts() {
    const [families, invoices, credit] = await Promise.all([
      this.people.allFamilies(),
      this.txHost.tx.query<{ id: string; family_id: string }[]>(
        `SELECT id, family_id FROM invoices WHERE status = 'issued'`,
      ),
      this.ledger.creditByFamily(),
    ]);
    const balances = await this.ledger.balances(
      invoices.map((invoice) => invoice.id),
    );
    const owed = new Map<string, bigint>();
    for (const invoice of invoices) {
      owed.set(
        invoice.family_id,
        (owed.get(invoice.family_id) ?? 0n) + balances.get(invoice.id)!.balance,
      );
    }
    return families.map((family) => ({
      familyId: family.id,
      familyName: family.name,
      balance: minorString(owed.get(family.id) ?? 0n),
      credit: minorString(credit.get(family.id) ?? 0n),
    }));
  }

  /** Money received per month, less refunds. */
  async collections(from: string, to: string) {
    const rows = await this.txHost.tx.query<
      { month: string; received: string; refunded: string }[]
    >(
      `WITH months AS (
         SELECT to_char(received_on, 'YYYY-MM') AS month, sum(amount) AS received, 0::bigint AS refunded
           FROM payments WHERE received_on BETWEEN $1 AND $2 GROUP BY 1
         UNION ALL
         SELECT to_char(r.created_at, 'YYYY-MM'), 0, sum(r.amount)
           FROM refunds r WHERE r.created_at::date BETWEEN $1 AND $2 GROUP BY 1
       )
       SELECT month, sum(received)::text AS received, sum(refunded)::text AS refunded FROM months GROUP BY month ORDER BY month`,
      [from, to],
    );
    return rows.map((row) => ({
      month: row.month,
      received: row.received,
      refunded: row.refunded,
      net: minorString(BigInt(row.received) - BigInt(row.refunded)),
    }));
  }

  async outstandingCsv(gradeLevelId?: string): Promise<string> {
    const report = await this.outstanding(gradeLevelId);
    await this.audit.record({
      action: 'billing.exported',
      entityType: 'billing_report',
      after: { report: 'outstanding', rows: report.families.length },
    });
    return toCsv([
      [
        'family',
        'currency',
        'total_minor',
        ...AGING_BUCKETS.map((bucket) => `${bucket}_minor`),
      ],
      ...report.families.map((row) => [
        row.familyName,
        report.currency,
        row.total,
        ...AGING_BUCKETS.map((bucket) => row.buckets[bucket]),
      ]),
    ]);
  }
}
