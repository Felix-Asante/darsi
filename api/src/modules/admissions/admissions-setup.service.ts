import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BillingSetupService } from '../billing/billing-setup.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import type { CycleDto, FormDto, StageDto } from './admissions.dto.js';
import {
  AdmissionCycle,
  AdmissionForm,
  AdmissionStage,
  Application,
  type StageKind,
} from './admissions.entities.js';

const DEFAULT_STAGES: { kind: StageKind; en: string; fr: string }[] = [
  { kind: 'submitted', en: 'Submitted', fr: 'Déposée' },
  { kind: 'review', en: 'Under review', fr: 'En cours d’examen' },
  { kind: 'interview', en: 'Interview', fr: 'Entretien' },
  { kind: 'offered', en: 'Offered', fr: 'Place proposée' },
  { kind: 'accepted', en: 'Accepted', fr: 'Acceptée' },
  { kind: 'enrolled', en: 'Enrolled', fr: 'Inscrit' },
  { kind: 'waitlisted', en: 'Waitlisted', fr: 'Liste d’attente' },
  { kind: 'declined', en: 'Declined', fr: 'Refusée' },
  { kind: 'withdrawn', en: 'Withdrawn', fr: 'Retirée' },
];

/** The pipeline needs these to work: where submissions land, offers, acceptance and refusal. */
const REQUIRED_KINDS: StageKind[] = [
  'submitted',
  'offered',
  'accepted',
  'enrolled',
  'declined',
];

const problem = (
  status: HttpStatus,
  code: string,
  field?: string,
  fieldCode?: string,
) =>
  new ProblemException(
    status,
    code,
    undefined,
    field ? [{ field, codes: [fieldCode ?? code] }] : undefined,
  );

export const cycleView = (cycle: AdmissionCycle) => ({
  id: cycle.id,
  academicYearId: cycle.academicYearId,
  name: cycle.name,
  opensOn: cycle.opensOn,
  closesOn: cycle.closesOn,
  grades: cycle.grades,
  applicationFee: cycle.applicationFee.toString(),
  depositFeeItemId: cycle.depositFeeItemId,
});

export const stageView = (stage: AdmissionStage) => ({
  id: stage.id,
  name: stage.name,
  kind: stage.kind,
  sortOrder: stage.sortOrder,
  email: stage.email,
});

/** Cycles, forms and pipeline stages (ADMS-1, ADMS-2, ADMS-5, ADMS-8). */
@Injectable()
export class AdmissionsSetupService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly academics: AcademicsService,
    private readonly billing: BillingSetupService,
    private readonly schools: SchoolsService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Cycles ──────────────────────────────────────────────────────────

  async cycles() {
    const cycles = await this.tx.find(AdmissionCycle, {
      order: { opensOn: 'DESC' },
    });
    return cycles.map(cycleView);
  }

  async findCycle(id: string): Promise<AdmissionCycle> {
    const cycle = await this.tx.findOneBy(AdmissionCycle, { id });
    if (!cycle) throw new NotFoundException();
    return cycle;
  }

  async saveCycle(dto: CycleDto, id?: string) {
    await this.academics.findYear(dto.academicYearId);
    if (dto.closesOn < dto.opensOn)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'closesOn',
        'min',
      );
    const grades = await this.academics.gradeLevelsByIds(
      dto.grades.map((grade) => grade.gradeLevelId),
    );
    if (
      grades.length !==
      new Set(dto.grades.map((grade) => grade.gradeLevelId)).size
    ) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'grades',
        'notFound',
      );
    }
    if (
      dto.depositFeeItemId &&
      !(await this.billing.findFeeItem(dto.depositFeeItemId))
    ) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'depositFeeItemId',
        'notFound',
      );
    }
    const cycle = id
      ? await this.findCycle(id)
      : this.tx.create(AdmissionCycle);
    Object.assign(cycle, {
      academicYearId: dto.academicYearId,
      name: dto.name,
      opensOn: dto.opensOn,
      closesOn: dto.closesOn,
      grades: dto.grades.map(({ gradeLevelId, places }) => ({
        gradeLevelId,
        places,
      })),
      applicationFee: BigInt(dto.applicationFee),
      depositFeeItemId: dto.depositFeeItemId ?? null,
    });
    return cycleView(await this.tx.save(cycle));
  }

  /** Cycles taking applications today, for the public page. */
  async openCycles() {
    const today = await this.clock.today();
    const cycles = await this.tx.find(AdmissionCycle, {
      order: { opensOn: 'ASC' },
    });
    return cycles.filter(
      (cycle) => cycle.opensOn <= today && cycle.closesOn >= today,
    );
  }

  // ── Forms ───────────────────────────────────────────────────────────

  async forms() {
    return (await this.tx.find(AdmissionForm)).map((form) => ({
      id: form.id,
      divisionId: form.divisionId,
      fields: form.fields,
      documents: form.documents,
    }));
  }

  async saveForm(dto: FormDto) {
    if (dto.divisionId) await this.academics.findDivision(dto.divisionId);
    const keys = [
      ...dto.fields.map((field) => field.key),
      ...dto.documents.map((document) => document.key),
    ];
    if (new Set(keys).size !== keys.length)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'fields',
        'duplicate',
      );
    if (
      dto.fields.some(
        (field) => field.type === 'select' && !field.options?.length,
      )
    ) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'fields',
        'options',
      );
    }
    const form =
      (await this.tx.findOneBy(AdmissionForm, {
        divisionId: dto.divisionId ?? IsNull(),
      })) ??
      this.tx.create(AdmissionForm, { divisionId: dto.divisionId ?? null });
    form.fields = dto.fields.map((field) => ({
      key: field.key,
      label: {
        en: field.label.en,
        ...(field.label.fr ? { fr: field.label.fr } : {}),
      },
      type: field.type,
      required: field.required,
      ...(field.type === 'select' ? { options: field.options } : {}),
    }));
    form.documents = dto.documents.map((document) => ({
      key: document.key,
      label: {
        en: document.label.en,
        ...(document.label.fr ? { fr: document.label.fr } : {}),
      },
      required: document.required,
    }));
    const saved = await this.tx.save(form);
    return {
      id: saved.id,
      divisionId: saved.divisionId,
      fields: saved.fields,
      documents: saved.documents,
    };
  }

  /** The division's own form, else the school-wide one, else an empty form. */
  async formForGrade(
    gradeLevelId: string,
  ): Promise<Pick<AdmissionForm, 'fields' | 'documents'>> {
    const grade = await this.academics.findGradeLevel(gradeLevelId);
    const forms = await this.tx.findBy(AdmissionForm, [
      { divisionId: grade.divisionId },
      { divisionId: IsNull() },
    ]);
    return (
      forms.find((form) => form.divisionId === grade.divisionId) ??
      forms[0] ?? { fields: [], documents: [] }
    );
  }

  // ── Stages ──────────────────────────────────────────────────────────

  /** The school's pipeline, created with sensible defaults the first time. */
  async stages(): Promise<AdmissionStage[]> {
    const stages = await this.tx.find(AdmissionStage, {
      order: { sortOrder: 'ASC' },
    });
    if (stages.length) return stages;
    const locale =
      (await this.schools.getCurrent()).defaultLocale === 'fr' ? 'fr' : 'en';
    return this.tx.save(
      DEFAULT_STAGES.map((stage, index) =>
        this.tx.create(AdmissionStage, {
          name: stage[locale],
          kind: stage.kind,
          sortOrder: index,
          email: null,
        }),
      ),
    );
  }

  async saveStages(input: StageDto[]) {
    const kinds = new Set(input.map((stage) => stage.kind));
    const missing = REQUIRED_KINDS.filter((kind) => !kinds.has(kind));
    if (missing.length)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'stages',
        'requiredKinds',
      );
    if (
      new Set(input.map((stage) => stage.name.trim().toLowerCase())).size !==
      input.length
    ) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'stages',
        'duplicate',
      );
    }
    const existing = await this.stages();
    const keptIds = input.flatMap((stage) => (stage.id ? [stage.id] : []));
    if (keptIds.some((id) => !existing.some((stage) => stage.id === id)))
      throw new NotFoundException();
    const removed = existing.filter((stage) => !keptIds.includes(stage.id));
    if (
      removed.length &&
      (await this.tx.existsBy(Application, {
        stageId: In(removed.map((stage) => stage.id)),
      }))
    ) {
      throw problem(HttpStatus.CONFLICT, 'in_use');
    }
    if (removed.length)
      await this.tx.delete(AdmissionStage, {
        id: In(removed.map((stage) => stage.id)),
      });
    // Names are unique, so park the kept ones under temporary names before renaming.
    if (keptIds.length) {
      await this.tx.query(
        `UPDATE admission_stages SET name = id::text WHERE id = ANY($1)`,
        [keptIds],
      );
    }
    const saved = await this.tx.save(
      input.map((stage, index) =>
        Object.assign(
          stage.id
            ? existing.find((entry) => entry.id === stage.id)!
            : this.tx.create(AdmissionStage),
          {
            name: stage.name.trim(),
            kind: stage.kind,
            sortOrder: index,
            email: stage.email
              ? {
                  en: stage.email.en,
                  ...(stage.email.fr ? { fr: stage.email.fr } : {}),
                }
              : null,
          },
        ),
      ),
    );
    await this.audit.record({
      action: 'admissions.stages_changed',
      entityType: 'admission_stage',
      after: { stages: saved.map((stage) => stage.name) },
    });
    return saved.sort((a, b) => a.sortOrder - b.sortOrder).map(stageView);
  }

  async stageOfKind(kind: StageKind): Promise<AdmissionStage> {
    const stage = (await this.stages()).find((entry) => entry.kind === kind);
    if (!stage) throw problem(HttpStatus.CONFLICT, 'stage_missing');
    return stage;
  }

  async findStage(id: string): Promise<AdmissionStage> {
    const stage = await this.tx.findOneBy(AdmissionStage, { id });
    if (!stage) throw new NotFoundException();
    return stage;
  }

  /** Places taken in a grade: applications offered, accepted or enrolled in this cycle. */
  async placesTaken(cycleId: string): Promise<Map<string, number>> {
    const rows = await this.tx.query<
      { grade_level_id: string; count: string }[]
    >(
      `SELECT a.grade_level_id, count(*)::text AS count
         FROM applications a JOIN admission_stages s ON s.id = a.stage_id
        WHERE a.cycle_id = $1 AND s.kind IN ('offered', 'accepted', 'enrolled')
        GROUP BY a.grade_level_id`,
      [cycleId],
    );
    return new Map(rows.map((row) => [row.grade_level_id, Number(row.count)]));
  }
}
