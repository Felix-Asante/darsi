import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Queue } from 'bullmq';
import { In } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AssessmentsService } from '../assessment/assessments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { DriveAccessService } from './drive-access.service.js';
import {
  DriveItem,
  FileQuota,
  type FilePurpose,
  StoredFile,
  StudentFile,
} from './entities/files.entities.js';
import { checkUpload, previewKind } from './file-rules.js';
import type { CreateUploadDto, StudentFileDto } from './files.dto.js';
import { MalwareScanner } from './scanning/malware-scanner.js';
import { ObjectStorage } from './object-storage.service.js';

export const FILES_QUEUE = 'files';

export interface ScanJob {
  schoolId: string;
  fileId: string;
}

export interface FileView {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: StoredFile['status'];
  preview: ReturnType<typeof previewKind>;
}

/** How another module decides who may upload and read the files it uses (portfolio items). */
export interface FileUsage {
  assertCanUpload: (target: CreateUploadDto['target']) => Promise<void>;
  canRead: (file: StoredFile) => Promise<boolean>;
}

export const fileView = (file: StoredFile): FileView => ({
  id: file.id,
  name: file.name,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  status: file.status,
  preview: previewKind(file.contentType),
});

const fieldError = (
  status: HttpStatus,
  code: string,
  field: string,
  fieldCode = code,
) =>
  new ProblemException(status, code, undefined, [
    { field, codes: [fieldCode] },
  ]);

/**
 * Uploads go straight from the browser to storage under `quarantine/`, are
 * scanned by the worker, and only then move to `clean/` and become available
 * (DRV-8). Every download is a fresh permission check and a 60-second link.
 */
@Injectable()
export class FilesService {
  private readonly usages = new Map<FilePurpose, FileUsage>();

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly storage: ObjectStorage,
    private readonly scanner: MalwareScanner,
    private readonly drive: DriveAccessService,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly assessments: AssessmentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    @InjectQueue(FILES_QUEUE) private readonly queue: Queue<ScanJob>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  registerUsage(purpose: FilePurpose, usage: FileUsage): void {
    this.usages.set(purpose, usage);
  }

  // ── Uploading ───────────────────────────────────────────────────────

  async createUpload({ name, contentType, size, target }: CreateUploadDto) {
    const problem = checkUpload(name, contentType, size);
    if (problem)
      throw fieldError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'file_not_allowed',
        problem === 'tooLarge' ? 'size' : 'name',
        problem,
      );
    const usage = await this.usage();
    if (usage.usedBytes + size > usage.quotaBytes) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'quota_exceeded',
        'The school has used its storage',
      );
    }

    const purpose: FilePurpose = target.type;
    const id = uuidv7();
    const file = this.tx.create(StoredFile, {
      id,
      name,
      contentType,
      sizeBytes: size,
      status: 'pending',
      purpose,
      storageKey: `quarantine/school/${this.context.requireSchoolId()}/${purpose}/${id}`,
      uploadedBy: this.context.requireUserId(),
      scannedAt: null,
    });

    if (target.type === 'drive') {
      if (!target.classId)
        throw fieldError(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'target.classId',
          'required',
        );
      await this.academics.findClass(target.classId);
      if (!(await this.drive.forClass(target.classId)).manage)
        throw new ForbiddenException();
      const parent = await this.folder(target.classId, target.parentId ?? null);
      await this.tx.save(file);
      await this.tx.save(
        this.tx.create(DriveItem, {
          classId: target.classId,
          parentId: parent?.id ?? null,
          kind: 'file',
          name,
          fileId: id,
          visibility: [
            ...new Set(target.visibility ?? parent?.visibility ?? []),
          ],
          createdBy: file.uploadedBy,
          updatedBy: file.uploadedBy,
        }),
      );
    } else if (target.type === 'student') {
      if (!target.studentId)
        throw fieldError(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'target.studentId',
          'required',
        );
      if (!rolesAllow(this.context.roles, { people: ['manage'] }))
        throw new ForbiddenException();
      await this.policy.assertStudentAccess(target.studentId);
      await this.tx.save(file);
      await this.tx.save(
        this.tx.create(StudentFile, {
          studentId: target.studentId,
          fileId: id,
          title: target.title?.trim() || name,
          visibleToFamily: target.visibleToFamily ?? false,
        }),
      );
    } else if (target.type === 'portfolio' || target.type === 'application') {
      await this.usageFor(target.type).assertCanUpload(target);
      await this.tx.save(file);
    } else {
      if (!target.assessmentId)
        throw fieldError(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'target.assessmentId',
          'required',
        );
      await this.tx.save(file);
      await this.assessments.submit(target.assessmentId, { fileId: id });
    }

    return {
      file: fileView(file),
      uploadUrl: await this.storage.presignUpload(
        file.storageKey,
        contentType,
        size,
      ),
    };
  }

  /** The browser has finished uploading: check it, then queue the scan. */
  async complete(id: string) {
    const file = await this.find(id);
    if (file.uploadedBy !== this.context.userId) throw new ForbiddenException();
    if (file.status !== 'pending') return fileView(file);
    if ((await this.storage.size(file.storageKey)) !== file.sizeBytes) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'upload_incomplete',
        'The file has not been uploaded',
      );
    }
    file.status = 'scanning';
    await this.tx.save(file);
    await this.queue.add(
      'scan',
      { schoolId: this.context.requireSchoolId(), fileId: id },
      { jobId: `scan-${id}` },
    );
    return fileView(file);
  }

  /** Runs in the worker. A file that fails the scan is deleted and its uploader told. */
  async scan({
    schoolId,
    fileId,
  }: ScanJob): Promise<StoredFile['status'] | null> {
    const file = await this.transactions.runInSchool(schoolId, () =>
      this.tx.findOneBy(StoredFile, { id: fileId }),
    );
    if (!file || file.status !== 'scanning') return file?.status ?? null;

    const verdict = await this.scanner.scan(
      await this.storage.read(file.storageKey),
    );
    const cleanKey = file.storageKey.replace(/^quarantine\//, 'clean/');
    if (verdict === 'clean') await this.storage.move(file.storageKey, cleanKey);
    else await this.storage.remove(file.storageKey);

    return this.transactions.runInSchool(schoolId, async () => {
      Object.assign(file, {
        status: verdict === 'clean' ? 'available' : 'rejected',
        storageKey: verdict === 'clean' ? cleanKey : file.storageKey,
        scannedAt: new Date(),
      });
      await this.tx.save(file);
      if (verdict === 'infected') {
        await this.audit.record({
          action: 'file.rejected',
          entityType: 'file',
          entityId: file.id,
          after: { reason: 'malware' },
        });
        if (file.uploadedBy) {
          await this.notifications.notify({
            userIds: [file.uploadedBy],
            type: 'file.rejected',
            params: { name: file.name },
          });
        }
      }
      return file.status;
    });
  }

  // ── Downloading ─────────────────────────────────────────────────────

  async download(id: string, inline: boolean) {
    const file = await this.find(id);
    await this.assertCanRead(file);
    if (file.status !== 'available') {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'file_not_ready',
        'The file is not available yet',
      );
    }
    return {
      url: await this.storage.presignDownload(
        file.storageKey,
        file.name,
        inline && previewKind(file.contentType) !== null,
      ),
      ...fileView(file),
    };
  }

  /** Decided from where the file is used, with today's class lists and links. */
  private async assertCanRead(file: StoredFile) {
    const userId = this.context.requireUserId();
    if (file.purpose === 'drive') {
      const item = await this.tx.findOneBy(DriveItem, { fileId: file.id });
      if (!item) throw new NotFoundException();
      const access = await this.drive.forClass(item.classId);
      if (file.uploadedBy === userId && access.manage) return;
      if (await this.drive.canSee(item, access)) return;
    } else if (file.purpose === 'student') {
      const entry = await this.tx.findOneBy(StudentFile, { fileId: file.id });
      if (!entry) throw new NotFoundException();
      if (rolesAllow(this.context.roles, { people: ['read'] })) return;
      if (
        entry.visibleToFamily &&
        (await this.policy.ownStudentIds()).includes(entry.studentId)
      )
        return;
    } else if (file.purpose === 'portfolio' || file.purpose === 'application') {
      if (await this.usageFor(file.purpose).canRead(file)) return;
    } else {
      const owner = await this.assessments.submissionOwner(file.id);
      if (!owner) throw new NotFoundException();
      if ((await this.policy.ownStudentIds()).includes(owner.studentId)) return;
      if (this.policy.isSchoolWide) return;
      const role = await this.policy.classRole(owner.classId);
      if (role === 'teacher' || role === 'teaching_assistant') return;
    }
    throw new ForbiddenException();
  }

  /**
   * Stores a file the platform made (a report PDF) on the student's record.
   * It skips the malware scan: nothing in it came from a user's upload.
   */
  async storeStudentDocument(
    studentId: string,
    name: string,
    title: string,
    content: Buffer,
    contentType: string,
  ) {
    const id = uuidv7();
    const file = await this.tx.save(
      this.tx.create(StoredFile, {
        id,
        name,
        contentType,
        sizeBytes: content.length,
        status: 'available',
        purpose: 'student',
        storageKey: `clean/school/${this.context.requireSchoolId()}/student/${id}`,
        uploadedBy: null,
        scannedAt: null,
      }),
    );
    await this.storage.put(file.storageKey, content, contentType);
    await this.tx.save(
      this.tx.create(StudentFile, {
        studentId,
        fileId: id,
        title,
        visibleToFamily: true,
      }),
    );
    return file;
  }

  /** Moves an application document onto the student's record, for staff only (ADMS-11). */
  async adoptAsStudentFile(fileId: string, studentId: string, title: string) {
    const file = await this.tx.findOneBy(StoredFile, { id: fileId });
    if (!file || file.purpose !== 'application') return;
    file.purpose = 'student';
    await this.tx.save(file);
    await this.tx.save(
      this.tx.create(StudentFile, {
        studentId,
        fileId,
        title,
        visibleToFamily: false,
      }),
    );
  }

  // ── Student files ───────────────────────────────────────────────────

  /** Official documents on a student's record (RPT-7); families see only those shared with them. */
  async studentFiles(studentId: string) {
    await this.policy.assertStudentAccess(studentId);
    const staff = rolesAllow(this.context.roles, { people: ['read'] });
    const entries = await this.tx.find(StudentFile, {
      where: { studentId, ...(staff ? {} : { visibleToFamily: true }) },
      order: { createdAt: 'DESC' },
    });
    const files = entries.length
      ? await this.filesByIds(entries.map((entry) => entry.fileId))
      : [];
    return entries.flatMap((entry) => {
      const file = files.find((candidate) => candidate.id === entry.fileId);
      if (!file || (!staff && file.status !== 'available')) return [];
      return [
        {
          id: entry.id,
          title: entry.title,
          visibleToFamily: entry.visibleToFamily,
          createdAt: entry.createdAt,
          file: fileView(file),
        },
      ];
    });
  }

  async updateStudentFile(id: string, dto: StudentFileDto) {
    if (!rolesAllow(this.context.roles, { people: ['manage'] }))
      throw new ForbiddenException();
    const entry = await this.tx.findOneBy(StudentFile, { id });
    if (!entry) throw new NotFoundException();
    Object.assign(entry, {
      ...(dto.title === undefined ? {} : { title: dto.title }),
      ...(dto.visibleToFamily === undefined
        ? {}
        : { visibleToFamily: dto.visibleToFamily }),
    });
    await this.tx.save(entry);
  }

  async removeStudentFile(id: string) {
    if (!rolesAllow(this.context.roles, { people: ['manage'] }))
      throw new ForbiddenException();
    const entry = await this.tx.findOneBy(StudentFile, { id });
    if (!entry) throw new NotFoundException();
    await this.deleteFiles([entry.fileId]);
  }

  // ── Storage use ─────────────────────────────────────────────────────

  /** Everything not rejected counts, including uploads still being scanned (DRV-9). */
  async usage(): Promise<{ usedBytes: number; quotaBytes: number }> {
    const [row] = await this.tx.query<{ used: string }[]>(
      `SELECT COALESCE(sum(size_bytes), 0)::text AS used FROM files WHERE status <> 'rejected'`,
    );
    const quota = await this.tx.findOneBy(FileQuota, {});
    return {
      usedBytes: Number(row.used),
      quotaBytes:
        quota?.quotaBytes ??
        this.config.get('FILE_QUOTA_BYTES', { infer: true }),
    };
  }

  /** Removes files and their stored objects. Missing objects are not an error. */
  async deleteFiles(ids: string[]) {
    if (ids.length === 0) return;
    const files = await this.filesByIds(ids);
    await this.tx.delete(StoredFile, ids);
    for (const file of files.filter(
      (candidate) => candidate.status !== 'rejected',
    )) {
      await this.storage.remove(file.storageKey).catch(() => undefined);
    }
  }

  async find(id: string): Promise<StoredFile> {
    const file = await this.tx.findOneBy(StoredFile, { id });
    if (!file) throw new NotFoundException();
    return file;
  }

  async filesByIds(ids: string[]): Promise<StoredFile[]> {
    return ids.length ? this.tx.findBy(StoredFile, { id: In(ids) }) : [];
  }

  private usageFor(purpose: FilePurpose): FileUsage {
    const usage = this.usages.get(purpose);
    if (!usage) throw new ForbiddenException();
    return usage;
  }

  private async folder(
    classId: string,
    folderId: string | null,
  ): Promise<DriveItem | null> {
    if (!folderId) return null;
    const folder = await this.tx.findOneBy(DriveItem, {
      id: folderId,
      classId,
      kind: 'folder',
    });
    if (!folder)
      throw fieldError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'target.parentId',
        'notFound',
      );
    return folder;
  }
}
