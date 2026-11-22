import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

/** The school's own date and time zone: what "today" means for attendance, enrolments and deadlines. */
@Injectable()
export class SchoolClock {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async timeZone(): Promise<string> {
    const [row] = await this.txHost.tx.query<{ time_zone: string }[]>(
      `SELECT time_zone FROM schools WHERE school_id = app_current_school_id()`,
    );
    return row?.time_zone ?? 'UTC';
  }

  /** Today's date in the school's time zone, as `YYYY-MM-DD`. */
  async today(): Promise<string> {
    const [row] = await this.txHost.tx.query<{ today: string }[]>(
      `SELECT to_char((now() AT TIME ZONE coalesce(
          (SELECT time_zone FROM schools WHERE school_id = app_current_school_id()), 'UTC'))::date, 'YYYY-MM-DD') AS today`,
    );
    return row.today;
  }
}
