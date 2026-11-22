import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import {
  type DriveAccess,
  DriveAccessService,
} from './drive-access.service.js';
import {
  AttachmentLink,
  type AttachmentTarget,
  DriveItem,
} from './entities/files.entities.js';
import type { FolderDto, UpdateDriveItemDto } from './files.dto.js';
import { type FileView, fileView, FilesService } from './files.service.js';

export interface DriveItemView {
  id: string;
  classId: string;
  parentId: string | null;
  kind: DriveItem['kind'];
  name: string;
  visibility: DriveItem['visibility'];
  file: FileView | null;
  updatedAt: Date;
}

const invalid = (field: string, code: string) =>
  new ProblemException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'validation_failed',
    undefined,
    [{ field, codes: [code] }],
  );

@Injectable()
export class DriveService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly access: DriveAccessService,
    private readonly academics: AcademicsService,
    private readonly files: FilesService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  /** A folder's contents (or the top of the drive), as the user is allowed to see them (DRV-1/3/4). */
  async list(classId: string, folderId?: string) {
    await this.academics.findClass(classId);
    const access = await this.access.forClass(classId);
    if (!access.seesAll && access.audiences.length === 0)
      throw new ForbiddenException();
    const folder = folderId
      ? await this.findIn(classId, folderId, 'folder')
      : null;
    if (folder && !(await this.access.canSee(folder, access)))
      throw new ForbiddenException();

    const items = await this.tx.find(DriveItem, {
      where: { classId, parentId: folder ? folder.id : IsNull() },
      order: { kind: 'DESC', name: 'ASC' },
    });
    const visible = access.seesAll
      ? items
      : items.filter((item) =>
          item.visibility.some((audience) =>
            access.audiences.includes(audience),
          ),
        );
    return {
      access: { manage: access.manage, delete: access.delete },
      path: folder
        ? (await this.access.ancestry(folder))
            .reverse()
            .map(({ id, name }) => ({ id, name }))
        : [],
      items: (await this.views(visible)).filter((item) =>
        this.mayShow(item, access),
      ),
    };
  }

  async createFolder(classId: string, dto: FolderDto): Promise<DriveItemView> {
    await this.academics.findClass(classId);
    if (!(await this.access.forClass(classId)).manage)
      throw new ForbiddenException();
    const parent = dto.parentId
      ? await this.findIn(classId, dto.parentId, 'folder')
      : null;
    const userId = this.context.requireUserId();
    const folder = await this.tx.save(
      this.tx.create(DriveItem, {
        classId,
        parentId: parent?.id ?? null,
        kind: 'folder',
        name: dto.name.trim(),
        fileId: null,
        visibility: [...new Set(dto.visibility ?? parent?.visibility ?? [])],
        createdBy: userId,
        updatedBy: userId,
      }),
    );
    return (await this.views([folder]))[0];
  }

  /** Rename, move or change who sees an item (DRV-2/3). */
  async update(id: string, dto: UpdateDriveItemDto): Promise<DriveItemView> {
    const item = await this.find(id);
    if (!(await this.access.forClass(item.classId)).manage)
      throw new ForbiddenException();
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        const parent = await this.findIn(item.classId, dto.parentId, 'folder');
        const below = await this.access.descendantIds([item.id]);
        if (parent.id === item.id || below.includes(parent.id))
          throw invalid('parentId', 'intoItself');
      }
      item.parentId = dto.parentId;
    }
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.visibility !== undefined)
      item.visibility = [...new Set(dto.visibility)];
    item.updatedBy = this.context.requireUserId();
    return (await this.views([await this.tx.save(item)]))[0];
  }

  /** Teachers only; a folder goes with everything in it (DRV-2). */
  async remove(id: string): Promise<void> {
    const item = await this.find(id);
    if (!(await this.access.forClass(item.classId)).delete)
      throw new ForbiddenException();
    const ids = [item.id, ...(await this.access.descendantIds([item.id]))];
    const fileIds = (await this.tx.findBy(DriveItem, { id: In(ids) })).flatMap(
      (entry) => (entry.fileId ? [entry.fileId] : []),
    );
    await this.tx.delete(DriveItem, { id: In(ids) });
    await this.files.deleteFiles(fileIds);
  }

  // ── Attachments (DRV-10) ────────────────────────────────────────────

  /** Replaces what is attached to a lesson, assessment or announcement. Only drive managers attach. */
  async setAttachments(
    targetType: AttachmentTarget,
    targetId: string,
    driveItemIds: string[],
  ) {
    const items = driveItemIds.length
      ? await this.tx.findBy(DriveItem, { id: In(driveItemIds), kind: 'file' })
      : [];
    if (items.length !== new Set(driveItemIds).size)
      throw invalid('driveItemIds', 'notFound');
    for (const classId of new Set(items.map((item) => item.classId))) {
      if (!(await this.access.forClass(classId)).manage)
        throw new ForbiddenException();
    }
    await this.tx.delete(AttachmentLink, { targetType, targetId });
    for (const item of items)
      await this.tx.save(
        this.tx.create(AttachmentLink, {
          driveItemId: item.id,
          targetType,
          targetId,
        }),
      );
    return this.attachments(targetType, targetId);
  }

  /** The attached files this user may open. Others stay hidden rather than failing the page. */
  async attachments(
    targetType: AttachmentTarget,
    targetId: string,
  ): Promise<DriveItemView[]> {
    const links = await this.tx.findBy(AttachmentLink, {
      targetType,
      targetId,
    });
    const items = links.length
      ? await this.tx.findBy(DriveItem, {
          id: In(links.map((link) => link.driveItemId)),
        })
      : [];
    const visible: DriveItem[] = [];
    const accessByClass = new Map<string, DriveAccess>();
    for (const item of items) {
      const access =
        accessByClass.get(item.classId) ??
        (await this.access.forClass(item.classId));
      accessByClass.set(item.classId, access);
      if (await this.access.canSee(item, access)) visible.push(item);
    }
    return (await this.views(visible)).filter(
      (item) => item.file?.status === 'available',
    );
  }

  private mayShow(item: DriveItemView, access: DriveAccess) {
    return (
      item.kind === 'folder' ||
      access.seesAll ||
      item.file?.status === 'available'
    );
  }

  private async views(items: DriveItem[]): Promise<DriveItemView[]> {
    const files = await this.files.filesByIds(
      items.flatMap((item) => (item.fileId ? [item.fileId] : [])),
    );
    return items.map((item) => {
      const file = files.find((candidate) => candidate.id === item.fileId);
      return {
        id: item.id,
        classId: item.classId,
        parentId: item.parentId,
        kind: item.kind,
        name: item.name,
        visibility: item.visibility,
        file: file ? fileView(file) : null,
        updatedAt: item.updatedAt,
      };
    });
  }

  private async find(id: string): Promise<DriveItem> {
    const item = await this.tx.findOneBy(DriveItem, { id });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async findIn(
    classId: string,
    id: string,
    kind: DriveItem['kind'],
  ): Promise<DriveItem> {
    const item = await this.tx.findOneBy(DriveItem, { id, classId, kind });
    if (!item) throw invalid('parentId', 'notFound');
    return item;
  }
}
