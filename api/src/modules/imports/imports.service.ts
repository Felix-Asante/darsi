import { InjectQueue } from '@nestjs/bullmq';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Queue } from 'bullmq';
import { toProblemFromDatabase } from '../../common/errors/database-errors.js';
import {
  ProblemException,
  type ProblemBody,
} from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { parseCsv } from './csv.js';
import type { CreateImportDto } from './dto/create-import.dto.js';
import {
  ImportJob,
  type ImportRowError,
} from './entities/import-job.entity.js';
import { IMPORT_COLUMNS } from './import-columns.js';
import { ImportRows } from './import-rows.js';

export const IMPORTS_QUEUE = 'imports';
const MAX_ROWS = 5000;
const MAX_REPORTED_ERRORS = 500;

export interface ImportQueueJob {
  jobId: string;
  schoolId: string;
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectQueue(IMPORTS_QUEUE) private readonly queue: Queue<ImportQueueJob>,
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly transactions: TenantTransactions,
    private readonly context: RequestContext,
    private readonly rows: ImportRows,
  ) {}

  /** Checks the header, stores the file and queues it. Rows are validated one by one by the worker. */
  async create({
    kind,
    fileName,
    content,
  }: CreateImportDto): Promise<ImportJob> {
    const { headers, rows } = parseCsv(content);
    const missing = IMPORT_COLUMNS[kind].required.filter(
      (column) => !headers.includes(column),
    );
    if (missing.length > 0) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'missing_columns',
        `Missing columns: ${missing.join(', ')}`,
        missing.map((column) => ({ field: column, codes: ['missingColumn'] })),
      );
    }
    if (rows.length === 0)
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'empty_file',
        'The file has no rows',
      );
    if (rows.length > MAX_ROWS) {
      throw new ProblemException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'too_many_rows',
        `At most ${MAX_ROWS} rows per file`,
      );
    }

    const job = await this.txHost.tx.save(
      this.txHost.tx.create(ImportJob, {
        kind,
        fileName,
        content,
        status: 'queued',
        totalRows: rows.length,
        importedRows: 0,
        failedRows: 0,
        errors: [],
        createdBy: this.context.userId ?? null,
        finishedAt: null,
      }),
    );
    await this.queue.add(
      'import',
      { jobId: job.id, schoolId: this.context.requireSchoolId() },
      { jobId: job.id },
    );
    return this.get(job.id);
  }

  list() {
    return this.txHost.tx.find(ImportJob, { order: { id: 'DESC' }, take: 20 });
  }

  async get(id: string): Promise<ImportJob> {
    const job = await this.txHost.tx.findOneBy(ImportJob, { id });
    if (!job) throw new NotFoundException();
    return job;
  }

  /**
   * Runs in the worker. Each row commits on its own, so valid rows are kept and
   * invalid ones are reported with their line number. Natural keys make a
   * re-run update the same records instead of duplicating them.
   */
  async process({ jobId, schoolId }: ImportQueueJob): Promise<void> {
    const job = await this.transactions.runInSchool(schoolId, async () => {
      const found = await this.txHost.tx.findOne(ImportJob, {
        where: { id: jobId },
        select: { id: true, kind: true, status: true, content: true },
      });
      if (!found || found.status === 'completed') return null;
      await this.txHost.tx.update(
        ImportJob,
        { id: jobId },
        { status: 'running' },
      );
      return found;
    });
    if (!job) return;

    const { rows } = parseCsv(job.content);
    const errors: ImportRowError[] = [];
    let imported = 0;
    let failed = 0;

    for (const [index, row] of rows.entries()) {
      try {
        await this.transactions.runInSchool(schoolId, () =>
          this.rows.handle(job.kind, row),
        );
        imported += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < MAX_REPORTED_ERRORS)
          errors.push(...rowErrors(index + 2, error));
      }
    }

    await this.transactions.runInSchool(schoolId, () =>
      this.txHost.tx.update(
        ImportJob,
        { id: jobId },
        {
          status: 'completed',
          importedRows: imported,
          failedRows: failed,
          errors,
          finishedAt: new Date(),
        },
      ),
    );
  }
}

function rowErrors(row: number, error: unknown): ImportRowError[] {
  const problem = toProblemFromDatabase(error) ?? error;
  if (!(problem instanceof HttpException))
    return [{ row, field: null, code: 'internal_error' }];

  const body = problem.getResponse() as Partial<ProblemBody>;
  if (body.errors?.length) {
    return body.errors.map(({ field, codes }) => ({
      row,
      field: field.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`),
      code: codes[0],
    }));
  }
  return [{ row, field: null, code: body.code ?? 'error' }];
}
