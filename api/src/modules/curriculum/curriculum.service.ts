import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import type { FrameworkDto, StandardDto } from './dto/curriculum.dto.js';
import { Framework } from './entities/framework.entity.js';
import { Standard } from './entities/standard.entity.js';

export interface StandardNode {
  id: string;
  code: string;
  description: string;
  children: StandardNode[];
}

@Injectable()
export class CurriculumService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  async listFrameworks() {
    const frameworks = await this.tx.find(Framework, {
      order: { name: 'ASC' },
    });
    const counts = await this.tx.query<
      { framework_id: string; count: number }[]
    >(
      `SELECT framework_id, count(*)::int AS count FROM standards GROUP BY framework_id`,
    );
    return frameworks.map(({ id, code, name, description }) => ({
      id,
      code,
      name,
      description,
      standardCount: counts.find((row) => row.framework_id === id)?.count ?? 0,
    }));
  }

  createFramework(dto: FrameworkDto) {
    return this.tx.save(
      this.tx.create(Framework, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
  }

  async updateFramework(id: string, dto: FrameworkDto) {
    const framework = await this.findFramework(id);
    return this.tx.save(
      Object.assign(framework, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
  }

  async findFramework(id: string): Promise<Framework> {
    const framework = await this.tx.findOneBy(Framework, { id });
    if (!framework) throw new NotFoundException();
    return framework;
  }

  /** Throws unless every id is a standard of this school. */
  async assertStandardsExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    if (
      (await this.tx.countBy(Standard, { id: In(unique) })) !== unique.length
    ) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'standardIds', codes: ['notFound'] }],
      );
    }
  }

  findFrameworkByCode(code: string) {
    return this.tx
      .createQueryBuilder(Framework, 'framework')
      .where('lower(framework.code) = lower(:code)', { code })
      .getOne();
  }

  /** The framework's standards as a tree, in teaching order. */
  async standardsTree(frameworkId: string): Promise<StandardNode[]> {
    await this.findFramework(frameworkId);
    const standards = await this.tx.find(Standard, {
      where: { frameworkId },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
    const nodes = new Map<string, StandardNode>(
      standards.map((standard) => [
        standard.id,
        {
          id: standard.id,
          code: standard.code,
          description: standard.description,
          children: [],
        },
      ]),
    );
    const roots: StandardNode[] = [];
    for (const standard of standards) {
      const node = nodes.get(standard.id)!;
      const parent = standard.parentId
        ? nodes.get(standard.parentId)
        : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  async createStandard(frameworkId: string, dto: StandardDto) {
    await this.findFramework(frameworkId);
    if (dto.parentId) await this.requireStandardIn(frameworkId, dto.parentId);
    return this.tx.save(
      this.tx.create(Standard, {
        frameworkId,
        code: dto.code,
        description: dto.description,
        parentId: dto.parentId ?? null,
        sortOrder:
          dto.sortOrder ?? (await this.tx.countBy(Standard, { frameworkId })),
      }),
    );
  }

  async updateStandard(id: string, dto: StandardDto) {
    const standard = await this.tx.findOneBy(Standard, { id });
    if (!standard) throw new NotFoundException();
    if (dto.parentId) {
      if (dto.parentId === id)
        throw new ProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'invalid_parent',
          'A standard cannot be its own parent',
        );
      await this.requireStandardIn(standard.frameworkId, dto.parentId);
    }
    Object.assign(standard, {
      code: dto.code,
      description: dto.description,
      parentId: dto.parentId ?? null,
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });
    return this.tx.save(standard);
  }

  async deleteStandard(id: string): Promise<void> {
    const result = await this.tx.delete(Standard, { id });
    if (!result.affected) throw new NotFoundException();
  }

  /** Creates or updates by framework and code. Used by imports. */
  async upsertStandard(
    frameworkId: string,
    code: string,
    description: string,
    parentCode: string | null,
  ) {
    const parent = parentCode
      ? await this.tx.findOneBy(Standard, { frameworkId, code: parentCode })
      : null;
    if (parentCode && !parent) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'parent_not_found',
        'Unknown parent standard',
        [{ field: 'parent_code', codes: ['notFound'] }],
      );
    }
    const existing = await this.tx.findOneBy(Standard, { frameworkId, code });
    if (existing) {
      Object.assign(existing, { description, parentId: parent?.id ?? null });
      return this.tx.save(existing);
    }
    return this.createStandard(frameworkId, {
      code,
      description,
      parentId: parent?.id ?? null,
    });
  }

  private async requireStandardIn(frameworkId: string, id: string) {
    if (!(await this.tx.existsBy(Standard, { id, frameworkId }))) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'parent_not_found',
        'Unknown parent standard',
        [{ field: 'parentId', codes: ['notFound'] }],
      );
    }
  }
}
