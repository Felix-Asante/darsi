import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import type { DocumentSequence } from './billing.entities.js';

export interface InvoiceBalance {
  invoiceId: string;
  credited: bigint;
  paid: bigint;
  balance: bigint;
}

/**
 * What is owed and what is held, always computed from the records (issued
 * invoices, credit notes, payments, allocations and refunds), never stored.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  /**
   * The next number of a kind, taken under a row lock so numbers never repeat
   * or skip: the number is only used if the transaction commits (FEE-7).
   */
  async nextNumber(kind: DocumentSequence['kind']): Promise<number> {
    await this.tx.query(
      `INSERT INTO document_sequences (id, kind) VALUES ($1, $2) ON CONFLICT (school_id, kind) DO NOTHING`,
      [uuidv7(), kind],
    );
    const [row] = await this.tx.query<{ next_number: number }[]>(
      `SELECT next_number FROM document_sequences WHERE kind = $1 FOR UPDATE`,
      [kind],
    );
    await this.tx.query(
      `UPDATE document_sequences SET next_number = next_number + 1, updated_at = now() WHERE kind = $1`,
      [kind],
    );
    return row.next_number;
  }

  async balances(invoiceIds: string[]): Promise<Map<string, InvoiceBalance>> {
    if (invoiceIds.length === 0) return new Map();
    const rows = await this.tx.query<
      { id: string; total: string; credited: string; paid: string }[]
    >(
      `SELECT i.id, i.total::text,
              COALESCE((SELECT sum(amount) FROM credit_notes c WHERE c.invoice_id = i.id), 0)::text AS credited,
              COALESCE((SELECT sum(amount) FROM payment_allocations a WHERE a.invoice_id = i.id), 0)::text AS paid
         FROM invoices i WHERE i.id = ANY($1)`,
      [invoiceIds],
    );
    return new Map(
      rows.map((row) => {
        const credited = BigInt(row.credited);
        const paid = BigInt(row.paid);
        return [
          row.id,
          {
            invoiceId: row.id,
            credited,
            paid,
            balance: BigInt(row.total) - credited - paid,
          },
        ];
      }),
    );
  }

  /** A family's issued invoices that still owe something, for allocation. */
  async openInvoices(familyId: string) {
    const rows = await this.tx.query<
      { id: string; number: number; issue_date: string; due_date: string }[]
    >(
      `SELECT id, number, issue_date::text, due_date::text FROM invoices WHERE family_id = $1 AND status = 'issued'`,
      [familyId],
    );
    const balances = await this.balances(rows.map((row) => row.id));
    return rows
      .map((row) => ({
        id: row.id,
        number: row.number,
        issuedOn: row.issue_date,
        dueOn: row.due_date,
        outstanding: balances.get(row.id)!.balance,
      }))
      .filter((invoice) => invoice.outstanding > 0n);
  }

  /** Each payment's money not applied to an invoice nor refunded: the family's credit (FEE-13). */
  async unappliedByPayment(
    familyId: string,
  ): Promise<{ paymentId: string; receivedOn: string; amount: bigint }[]> {
    const rows = await this.tx.query<
      { id: string; received_on: string; kept: string }[]
    >(
      `SELECT p.id, p.received_on::text,
              (p.amount
                - COALESCE((SELECT sum(amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0)
                - COALESCE((SELECT sum(amount) FROM refunds r WHERE r.payment_id = p.id), 0))::text AS kept
         FROM payments p WHERE p.family_id = $1
        ORDER BY p.received_on, p.id`,
      [familyId],
    );
    return rows
      .map((row) => ({
        paymentId: row.id,
        receivedOn: row.received_on,
        amount: BigInt(row.kept),
      }))
      .filter((row) => row.amount > 0n);
  }

  /** Credit held by every family, in one query. */
  async creditByFamily(): Promise<Map<string, bigint>> {
    const rows = await this.tx.query<{ family_id: string; credit: string }[]>(
      `SELECT p.family_id, sum(p.amount
                - COALESCE((SELECT sum(amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0)
                - COALESCE((SELECT sum(amount) FROM refunds r WHERE r.payment_id = p.id), 0))::text AS credit
         FROM payments p GROUP BY p.family_id`,
    );
    return new Map(rows.map((row) => [row.family_id, BigInt(row.credit)]));
  }

  async familyCredit(familyId: string): Promise<bigint> {
    return (await this.unappliedByPayment(familyId)).reduce(
      (total, row) => total + row.amount,
      0n,
    );
  }
}
