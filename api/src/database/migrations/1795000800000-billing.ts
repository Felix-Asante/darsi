import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

const CURRENCY = `char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$')`;

/**
 * Fees, invoices, credit notes, payments, refunds and payment provider events.
 * Money is bigint minor units with a currency. Issued invoices, credit notes,
 * payments and refunds cannot be changed: triggers refuse it.
 */
export class Billing1795000800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'billing_settings',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL UNIQUE,
         rounding text NOT NULL DEFAULT 'half_up' CHECK (rounding IN ('half_up', 'half_even')),
         invoice_prefix text NOT NULL DEFAULT 'INV',
         payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
         reminder_days_before integer[] NOT NULL DEFAULT '{7}',
         reminder_days_after integer[] NOT NULL DEFAULT '{7,30}',
         stripe_account_id text,
         ${TIMESTAMPS}`,
      ],
      [
        'fee_items',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         kind text NOT NULL CHECK (kind IN ('tuition', 'registration', 'application', 'deposit', 'uniform', 'trip', 'other')),
         amount bigint NOT NULL CHECK (amount >= 0),
         currency ${CURRENCY},
         tax_rate_bp integer NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
         accounting_code text,
         active boolean NOT NULL DEFAULT true,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'fee_structures',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         academic_year_id uuid NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
         grade_level_id uuid REFERENCES grade_levels (id) ON DELETE CASCADE,
         name text NOT NULL,
         schedule text NOT NULL CHECK (schedule IN ('annual', 'term', 'monthly')),
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (academic_year_id, grade_level_id)`,
      ],
      [
        'fee_structure_lines',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         structure_id uuid NOT NULL REFERENCES fee_structures (id) ON DELETE CASCADE,
         fee_item_id uuid NOT NULL REFERENCES fee_items (id) ON DELETE RESTRICT,
         amount bigint NOT NULL CHECK (amount >= 0),
         ${TIMESTAMPS},
         UNIQUE (structure_id, fee_item_id)`,
      ],
      [
        'discounts',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         kind text NOT NULL CHECK (kind IN ('percent', 'fixed')),
         value bigint NOT NULL CHECK (value >= 0 AND (kind <> 'percent' OR value <= 10000)),
         fee_item_ids uuid[] NOT NULL DEFAULT '{}',
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'student_discounts',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         discount_id uuid NOT NULL REFERENCES discounts (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (student_id, discount_id)`,
      ],
      [
        'document_sequences',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         kind text NOT NULL CHECK (kind IN ('invoice', 'credit_note', 'receipt')),
         next_number integer NOT NULL DEFAULT 1,
         ${TIMESTAMPS},
         UNIQUE (school_id, kind)`,
      ],
      [
        'invoices',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         family_id uuid NOT NULL REFERENCES families (id) ON DELETE RESTRICT,
         status text NOT NULL CHECK (status IN ('draft', 'issued')),
         number integer,
         reference text,
         period_key text,
         currency ${CURRENCY},
         issue_date date,
         due_date date,
         subtotal bigint NOT NULL DEFAULT 0,
         discount_total bigint NOT NULL DEFAULT 0,
         tax_total bigint NOT NULL DEFAULT 0,
         total bigint NOT NULL DEFAULT 0,
         notes text,
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         issued_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK ((status = 'issued') = (number IS NOT NULL AND issue_date IS NOT NULL AND due_date IS NOT NULL))`,
      ],
      [
        'invoice_lines',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
         student_id uuid REFERENCES students (id) ON DELETE SET NULL,
         fee_item_id uuid REFERENCES fee_items (id) ON DELETE SET NULL,
         description text NOT NULL,
         quantity integer NOT NULL CHECK (quantity > 0),
         unit_amount bigint NOT NULL CHECK (unit_amount >= 0),
         discount bigint NOT NULL DEFAULT 0 CHECK (discount >= 0),
         tax_rate_bp integer NOT NULL DEFAULT 0,
         tax bigint NOT NULL DEFAULT 0,
         total bigint NOT NULL,
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS}`,
      ],
      [
        'credit_notes',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
         number integer NOT NULL,
         amount bigint NOT NULL CHECK (amount > 0),
         currency ${CURRENCY},
         reason text NOT NULL,
         issued_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, number)`,
      ],
      [
        'payments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         family_id uuid NOT NULL REFERENCES families (id) ON DELETE RESTRICT,
         amount bigint NOT NULL CHECK (amount > 0),
         currency ${CURRENCY},
         method text NOT NULL CHECK (method IN ('cash', 'transfer', 'cheque', 'card')),
         reference text,
         received_on date NOT NULL,
         receipt_number integer NOT NULL,
         provider_payment_id text,
         recorded_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, receipt_number),
         UNIQUE (school_id, provider_payment_id)`,
      ],
      [
        'payment_allocations',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         payment_id uuid NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
         invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
         amount bigint NOT NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'refunds',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         payment_id uuid NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
         amount bigint NOT NULL CHECK (amount > 0),
         reason text NOT NULL,
         provider_refund_id text,
         refunded_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'payment_provider_events',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         provider text NOT NULL,
         event_id text NOT NULL,
         type text NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (provider, event_id)`,
      ],
    ];
    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX invoices_number_idx ON invoices (school_id, number) WHERE number IS NOT NULL`,
    );
    // Generating a period twice gives the same invoice (FEE-5).
    await queryRunner.query(
      `CREATE UNIQUE INDEX invoices_period_idx ON invoices (family_id, period_key) WHERE period_key IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_family_idx ON invoices (school_id, family_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX payment_allocations_invoice_idx ON payment_allocations (school_id, invoice_id)`,
    );

    await queryRunner.query(
      `CREATE FUNCTION reject_issued_invoice_change() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF OLD.status = 'issued' THEN
           RAISE EXCEPTION 'issued invoices cannot be changed; issue a credit note' USING ERRCODE = 'check_violation';
         END IF;
         RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
       END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER invoices_immutable BEFORE UPDATE OR DELETE ON invoices
         FOR EACH ROW EXECUTE FUNCTION reject_issued_invoice_change()`,
    );
    await queryRunner.query(
      `CREATE FUNCTION reject_issued_line_change() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF EXISTS (SELECT 1 FROM invoices WHERE id = COALESCE(OLD.invoice_id, NEW.invoice_id) AND status = 'issued') THEN
           RAISE EXCEPTION 'issued invoices cannot be changed; issue a credit note' USING ERRCODE = 'check_violation';
         END IF;
         RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
       END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER invoice_lines_immutable BEFORE INSERT OR UPDATE OR DELETE ON invoice_lines
         FOR EACH ROW EXECUTE FUNCTION reject_issued_line_change()`,
    );
    await queryRunner.query(
      `CREATE FUNCTION reject_financial_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION '% records cannot be changed', TG_TABLE_NAME USING ERRCODE = 'check_violation';
       END $$`,
    );
    for (const table of ['credit_notes', 'payments', 'refunds']) {
      await queryRunner.query(
        `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table}
           FOR EACH ROW EXECUTE FUNCTION reject_financial_record_change()`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'payment_provider_events',
      'refunds',
      'payment_allocations',
      'payments',
      'credit_notes',
      'invoice_lines',
      'invoices',
      'document_sequences',
      'student_discounts',
      'discounts',
      'fee_structure_lines',
      'fee_structures',
      'fee_items',
      'billing_settings',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
    for (const fn of [
      'reject_issued_invoice_change',
      'reject_issued_line_change',
      'reject_financial_record_change',
    ]) {
      await queryRunner.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  }
}
