import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull, LessThanOrEqual } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import type {
  ConversionDto,
  CreateScaleDto,
  PolicyDto,
  ScaleDefinitionDto,
  UpdateScaleDto,
} from './dto/grading.dto.js';
import { AssessmentCategory } from './entities/assessment-category.entity.js';
import { GradingPolicy } from './entities/grading-policy.entity.js';
import { GradingScaleVersion } from './entities/grading-scale-version.entity.js';
import { GradingScale } from './entities/grading-scale.entity.js';
import { ScaleConversion } from './entities/scale-conversion.entity.js';
import {
  convert,
  GradeValueError,
  parseValue,
  validateScale,
} from './grading/grading.js';
import { SCALE_PRESETS } from './grading/presets.js';
import type {
  AggregationMethod,
  ExplicitMapping,
  GradeValue,
  GradingScaleSnapshot,
} from './grading/types.js';
import { NUMERIC_KINDS } from './grading/types.js';

export interface ScaleView {
  id: string;
  name: string;
  kind: GradingScaleSnapshot['kind'];
  version: number;
  definition: GradingScaleSnapshot;
}

export interface PolicyView {
  id: string | null;
  subjectId: string | null;
  reportingScaleId: string | null;
  method: AggregationMethod;
  categories: { id: string; name: string; weight: number }[];
}

/** The rules to compute one subject's term results. */
export interface ReportingRules {
  method: AggregationMethod;
  reportingScale: ScaleView | null;
  categoryWeights: Record<string, number>;
}

const DEFAULT_METHOD: AggregationMethod = 'weighted_average';

function cleanDefinition(definition: ScaleDefinitionDto): GradingScaleSnapshot {
  const numeric = NUMERIC_KINDS.includes(definition.kind);
  return numeric
    ? {
        kind: definition.kind,
        ...(definition.kind === 'points'
          ? { maxPoints: definition.maxPoints }
          : {}),
        decimals:
          definition.decimals ?? (definition.kind === 'percentage' ? 0 : 1),
      }
    : {
        kind: definition.kind,
        levels: (definition.levels ?? []).map(
          ({ code, label, minMastery }) => ({
            code: code.trim(),
            ...(label?.trim() ? { label: label.trim() } : {}),
            minMastery,
          }),
        ),
      };
}

@Injectable()
export class GradingService {
  private readonly versions = new Map<string, GradingScaleSnapshot>();

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly academics: AcademicsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  presets() {
    return Object.entries(SCALE_PRESETS).map(([key, preset]) => ({
      key,
      name: preset.name,
      definition: preset.scale,
    }));
  }

  // ── Scales ──────────────────────────────────────────────────────────

  async listScales(): Promise<ScaleView[]> {
    const scales = await this.tx.find(GradingScale, { order: { name: 'ASC' } });
    return Promise.all(scales.map((scale) => this.view(scale)));
  }

  async getScale(id: string): Promise<ScaleView> {
    return this.view(await this.findScale(id));
  }

  async createScale(dto: CreateScaleDto): Promise<ScaleView> {
    const definition = dto.preset
      ? (SCALE_PRESETS[dto.preset].scale as GradingScaleSnapshot)
      : dto.definition && cleanDefinition(dto.definition);
    if (!definition) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'definition', codes: ['required'] }],
      );
    }
    assertValid(definition);
    const scale = await this.tx.save(
      this.tx.create(GradingScale, {
        name: dto.name,
        kind: definition.kind,
        currentVersion: 1,
      }),
    );
    await this.tx.save(
      this.tx.create(GradingScaleVersion, {
        scaleId: scale.id,
        scaleVersion: 1,
        definition,
      }),
    );
    return {
      id: scale.id,
      name: scale.name,
      kind: scale.kind,
      version: 1,
      definition,
    };
  }

  /** Saves a new version. Grades and assessments keep the version they were made with. */
  async updateScale(id: string, dto: UpdateScaleDto): Promise<ScaleView> {
    const scale = await this.findScale(id);
    const definition = cleanDefinition(dto.definition);
    if (definition.kind !== scale.kind) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'definition.kind', codes: ['unchangeable'] }],
      );
    }
    assertValid(definition);
    const current = await this.snapshot(id, scale.currentVersion);
    scale.name = dto.name;
    if (JSON.stringify(current) !== JSON.stringify(definition)) {
      scale.currentVersion += 1;
      await this.tx.save(
        this.tx.create(GradingScaleVersion, {
          scaleId: id,
          scaleVersion: scale.currentVersion,
          definition,
        }),
      );
    }
    await this.tx.save(scale);
    return this.view(scale);
  }

  async findScale(id: string): Promise<GradingScale> {
    const scale = await this.tx.findOneBy(GradingScale, { id });
    if (!scale) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'scale_not_found',
        'Unknown grading scale',
        [{ field: 'scaleId', codes: ['notFound'] }],
      );
    }
    return scale;
  }

  async snapshot(
    scaleId: string,
    version: number,
  ): Promise<GradingScaleSnapshot> {
    const key = `${this.context.schoolId}:${scaleId}:${version}`;
    const cached = this.versions.get(key);
    if (cached) return cached;
    const row = await this.tx.findOneBy(GradingScaleVersion, {
      scaleId,
      scaleVersion: version,
    });
    if (!row) throw new NotFoundException();
    // Versions never change, so they can be cached for the life of the process.
    this.versions.set(key, row.definition);
    return row.definition;
  }

  private async view(scale: GradingScale): Promise<ScaleView> {
    return {
      id: scale.id,
      name: scale.name,
      kind: scale.kind,
      version: scale.currentVersion,
      definition: await this.snapshot(scale.id, scale.currentVersion),
    };
  }

  // ── Conversions ─────────────────────────────────────────────────────

  /** The conversion tables in effect now, one per pair of scales. */
  async listConversions() {
    const rows = await this.tx.find(ScaleConversion, {
      order: { effectiveFrom: 'DESC' },
    });
    const latest = new Map<string, ScaleConversion>();
    for (const row of rows) {
      const key = `${row.fromScaleId}:${row.toScaleId}`;
      if (!latest.has(key)) latest.set(key, row);
    }
    return [...latest.values()].map(
      ({ id, fromScaleId, toScaleId, mapping, effectiveFrom }) => ({
        id,
        fromScaleId,
        toScaleId,
        mapping,
        effectiveFrom,
      }),
    );
  }

  /** Adds a table that applies to grades published from now on. */
  async saveConversion(dto: ConversionDto) {
    const [from, to] = await Promise.all([
      this.getScale(dto.fromScaleId),
      this.getScale(dto.toScaleId),
    ]);
    if (from.id === to.id) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'toScaleId', codes: ['sameScale'] }],
      );
    }
    const mapping: ExplicitMapping = {};
    for (const [source, target] of Object.entries(dto.mapping)) {
      if (target === '' || target === null) continue;
      try {
        mapping[String(parseValue(from.definition, source))] = String(
          parseValue(to.definition, String(target)),
        );
      } catch (error) {
        if (!(error instanceof GradeValueError)) throw error;
        throw new ProblemException(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          undefined,
          [{ field: `mapping.${source}`, codes: [error.code] }],
        );
      }
    }
    return this.tx.save(
      this.tx.create(ScaleConversion, {
        fromScaleId: from.id,
        toScaleId: to.id,
        mapping,
        effectiveFrom: new Date(),
        createdBy: this.context.userId ?? null,
      }),
    );
  }

  /** The table in effect at `at` (the grade's publish time), or none. */
  async mappingAt(
    fromScaleId: string,
    toScaleId: string,
    at: Date,
  ): Promise<ExplicitMapping | undefined> {
    const row = await this.tx.findOne(ScaleConversion, {
      where: { fromScaleId, toScaleId, effectiveFrom: LessThanOrEqual(at) },
      order: { effectiveFrom: 'DESC' },
    });
    return row?.mapping;
  }

  /** Shows a value on another scale, using the school's table in effect at `at`. */
  async convertValue(
    from: { scaleId: string; version: number },
    to: ScaleView,
    value: GradeValue,
    at = new Date(),
  ): Promise<GradeValue> {
    const source = await this.snapshot(from.scaleId, from.version);
    if (from.scaleId === to.id) return convert(source, to.definition, value);
    return convert(
      source,
      to.definition,
      value,
      await this.mappingAt(from.scaleId, to.id, at),
    );
  }

  async preview(fromScaleId: string, toScaleId: string, value: string) {
    const [from, to] = await Promise.all([
      this.getScale(fromScaleId),
      this.getScale(toScaleId),
    ]);
    try {
      return {
        value: await this.convertValue(
          { scaleId: from.id, version: from.version },
          to,
          value,
        ),
      };
    } catch (error) {
      if (!(error instanceof GradeValueError)) throw error;
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'value', codes: [error.code] }],
      );
    }
  }

  // ── Policies and categories ─────────────────────────────────────────

  async listPolicies(): Promise<PolicyView[]> {
    const [policies, categories] = await Promise.all([
      this.tx.find(GradingPolicy),
      this.tx.find(AssessmentCategory, { order: { name: 'ASC' } }),
    ]);
    return policies.map((policy) => this.policyView(policy, categories));
  }

  async savePolicy(dto: PolicyDto): Promise<PolicyView> {
    if (dto.subjectId) {
      const subjects = await this.academics.listSubjects();
      if (!subjects.some((subject) => subject.id === dto.subjectId)) {
        throw new ProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          undefined,
          [{ field: 'subjectId', codes: ['notFound'] }],
        );
      }
    }
    if (dto.reportingScaleId) await this.findScale(dto.reportingScaleId);
    const names = dto.categories.map((category) =>
      category.name.trim().toLowerCase(),
    );
    if (new Set(names).size !== names.length) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'categories', codes: ['uniqueNames'] }],
      );
    }

    const policy =
      (await this.tx.findOneBy(GradingPolicy, {
        subjectId: dto.subjectId ?? IsNull(),
      })) ??
      this.tx.create(GradingPolicy, { subjectId: dto.subjectId ?? null });
    policy.method = dto.method;
    policy.reportingScaleId = dto.reportingScaleId ?? null;
    await this.tx.save(policy);

    // Categories are matched by name, so renaming one is removing it and adding another.
    const existing = await this.tx.findBy(AssessmentCategory, {
      policyId: policy.id,
    });
    const keep = new Set<string>();
    for (const category of dto.categories) {
      const match = existing.find(
        (candidate) =>
          candidate.name.toLowerCase() === category.name.trim().toLowerCase(),
      );
      const saved = await this.tx.save(
        Object.assign(
          match ?? this.tx.create(AssessmentCategory, { policyId: policy.id }),
          {
            name: category.name.trim(),
            weight: category.weight,
          },
        ),
      );
      keep.add(saved.id);
    }
    const removed = existing
      .filter((category) => !keep.has(category.id))
      .map((category) => category.id);
    if (removed.length > 0)
      await this.tx.delete(AssessmentCategory, { id: In(removed) });

    return this.policyView(
      policy,
      await this.tx.findBy(AssessmentCategory, { policyId: policy.id }),
    );
  }

  /** The subject's policy, falling back to the school's default, then to a plain weighted average. */
  async rulesFor(
    subjectId: string | null,
  ): Promise<ReportingRules & { categories: PolicyView['categories'] }> {
    const policy =
      (subjectId
        ? await this.tx.findOneBy(GradingPolicy, { subjectId })
        : null) ??
      (await this.tx.findOneBy(GradingPolicy, { subjectId: IsNull() }));
    if (!policy)
      return {
        method: DEFAULT_METHOD,
        reportingScale: null,
        categoryWeights: {},
        categories: [],
      };
    const categories = await this.tx.findBy(AssessmentCategory, {
      policyId: policy.id,
    });
    return {
      method: policy.method,
      reportingScale: policy.reportingScaleId
        ? await this.getScale(policy.reportingScaleId)
        : null,
      categoryWeights: Object.fromEntries(
        categories.map((category) => [category.id, category.weight]),
      ),
      categories: categories.map(({ id, name, weight }) => ({
        id,
        name,
        weight,
      })),
    };
  }

  private policyView(
    policy: GradingPolicy,
    categories: AssessmentCategory[],
  ): PolicyView {
    return {
      id: policy.id,
      subjectId: policy.subjectId,
      reportingScaleId: policy.reportingScaleId,
      method: policy.method,
      categories: categories
        .filter((category) => category.policyId === policy.id)
        .map(({ id, name, weight }) => ({ id, name, weight })),
    };
  }
}

function assertValid(definition: GradingScaleSnapshot) {
  const errors = validateScale(definition);
  if (errors.length > 0) {
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'invalid_scale',
      'The scale definition is invalid',
      [{ field: 'definition', codes: errors }],
    );
  }
}
