import { ZodError } from "zod";
import type { CatalogCompatibility } from "../../catalog/ports/catalog-compatibility.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import {
  CONTENT_VALIDATOR_VERSION,
  PLAYABLE_SLICE_SCHEMA_VERSION,
  type ValidatedContentBundle,
} from "../domain/content-document.ts";
import { assembleContentBundle } from "../domain/assemble-content-bundle.ts";
import {
  isContentType,
  parseDraftDocument,
  type ContentType,
} from "../domain/parse-content-document.ts";
import type {
  ActivateCandidateResult,
  BuildCandidateCommand,
  CandidateOverlay,
  ContentEditor,
  ContentReleaseStatus,
  SaveDraftCommand,
  SaveDraftResult,
  ValidateCandidateResult,
  ValidationReportIssues,
} from "../ports/content-editor.ts";
import type { ContentEditorStore, PinnedReleaseEntry } from "../ports/content-editor-store.ts";
import type { ContentStore } from "../ports/content-store.ts";
import type { ContentActivationCompatibility } from "./content-activation-compatibility.ts";
import { ContentEditorError } from "./content-editor-error.ts";
import type { ContentMaterializer } from "./content-materializer.ts";
import { ContentValidationError } from "./content-validation-error.ts";
import type { ContentValidator } from "./content-validator.ts";

const OPERATOR_CREATED_BY = "operator";

export class ContentEditorService implements ContentEditor {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly publication: ContentStore,
    private readonly store: ContentEditorStore,
    private readonly validator: ContentValidator,
    private readonly activation: ContentActivationCompatibility,
    private readonly compatibility: CatalogCompatibility,
    private readonly materializer: ContentMaterializer,
  ) {}

  async saveDraft(command: SaveDraftCommand): Promise<SaveDraftResult> {
    const contentType = requireContentType(command.contentType);
    if (!command.contentKey) throw new ContentEditorError(400, "contentKey is required");
    if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1) {
      throw new ContentEditorError(400, "expectedVersion must be a positive integer");
    }
    const document = parseLocalDocument(contentType, command.document);
    return this.unitOfWork.run(async () => {
      const active = await this.store.requireActiveRelease();
      if (!(await this.store.hasReleaseEntry(active.id, contentType, command.contentKey))) {
        throw new ContentEditorError(
          400,
          `content ${contentType}:${command.contentKey} is not in the active release`,
        );
      }
      const current = await this.store.maxDraftVersion(contentType, command.contentKey);
      if (command.expectedVersion !== current) {
        throw new ContentEditorError(409, "expectedVersion does not match the current draft");
      }
      try {
        const saved = await this.store.appendDraftVersion({
          contentType,
          contentKey: command.contentKey,
          document,
          version: current + 1,
          schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
          createdBy: OPERATOR_CREATED_BY,
        });
        return { draftVersionId: saved.id, version: saved.version };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ContentEditorError(409, "expectedVersion does not match the current draft");
        }
        throw error;
      }
    });
  }

  async buildCandidate(command: BuildCandidateCommand): Promise<{ candidateId: string }> {
    if (!command.expectedActiveReleaseId) {
      throw new ContentEditorError(400, "expectedActiveReleaseId is required");
    }
    const overlays = command.overlays.map(parseOverlay);
    return this.unitOfWork.run(async () => {
      const active = await this.store.requireActiveRelease();
      if (active.id !== command.expectedActiveReleaseId) {
        throw new ContentEditorError(
          409,
          "expectedActiveReleaseId does not match the active release",
        );
      }
      const base = await this.store.listReleaseEntries(active.id);
      const entries = await pinOverlays(this.store, base, overlays);
      return {
        candidateId: await this.store.insertCandidate({
          expectedActiveReleaseId: active.id,
          createdBy: OPERATOR_CREATED_BY,
          entries,
        }),
      };
    });
  }

  async validateCandidate(candidateId: string): Promise<ValidateCandidateResult> {
    requireCandidateId(candidateId);
    return this.unitOfWork.run(async () => {
      const candidate = await this.requireCandidate(candidateId);
      const documents = await this.store.listCandidateDocuments(candidate.id);
      const issues = validateDocuments(this.validator, documents);
      const reportId = await this.store.insertValidationReport({
        candidateId: candidate.id,
        validatorVersion: CONTENT_VALIDATOR_VERSION,
        ok: issues.length === 0,
        issues: toReportIssues(issues),
      });
      await this.store.setCandidateStatus(
        candidate.id,
        issues.length === 0 ? "validated" : "invalid",
      );
      return { ok: issues.length === 0, reportId };
    });
  }

  async activateCandidate(candidateId: string): Promise<ActivateCandidateResult> {
    requireCandidateId(candidateId);
    return this.unitOfWork.run(async () => {
      const lockedId = await this.publication.lockPublication();
      if (!lockedId) throw new Error("No published content revision");
      const candidate = await this.requireCandidate(candidateId);
      if (candidate.expectedActiveReleaseId !== lockedId) {
        throw new ContentEditorError(
          409,
          "expectedActiveReleaseId does not match the active release",
        );
      }
      const report = await this.store.latestValidationReport(candidate.id);
      if (!report || !report.ok) {
        throw new ContentEditorError(422, "candidate is invalid", report?.id);
      }
      const pinned = await this.store.listCandidateEntries(candidate.id);
      const documents = await this.store.listCandidateDocuments(candidate.id);
      const validated = requireValidBundle(this.validator, documents);
      const existing = await this.publication.findByChecksum(validated.checksum);
      if (existing) {
        throw new ContentEditorError(409, `Release checksum ${validated.checksum} already exists`);
      }
      const previous = await this.compatibility.compatibilitySnapshot(lockedId);
      try {
        this.activation.assertCompatible(previous, validated);
      } catch (error) {
        if (error instanceof ContentValidationError) {
          throw new ContentEditorError(409, error.message);
        }
        throw error;
      }
      const release = await this.store.persistPinnedBundle(validated, pinned);
      await this.materializer.materialize(release.id, validated);
      await this.store.recordPublicationAudit({
        releaseId: release.id,
        candidateId: candidate.id,
        createdBy: OPERATOR_CREATED_BY,
      });
      await this.publication.activate(release.id);
      await this.store.setCandidateStatus(candidate.id, "activated");
      return { releaseId: release.id, version: release.version };
    });
  }

  async status(): Promise<ContentReleaseStatus> {
    return this.store.requireActiveRelease();
  }

  private async requireCandidate(candidateId: string) {
    const candidate = await this.store.findCandidate(candidateId);
    if (!candidate) throw new ContentEditorError(404, "candidate not found");
    if (candidate.status === "activated") {
      throw new ContentEditorError(409, "candidate is already activated");
    }
    return candidate;
  }
}

function requireContentType(value: string): ContentType {
  if (!isContentType(value)) throw new ContentEditorError(400, `unknown contentType ${value}`);
  return value;
}

function parseLocalDocument(contentType: ContentType, document: unknown) {
  try {
    return parseDraftDocument(contentType, document);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ContentEditorError(400, formatZodError(error));
    }
    throw error;
  }
}

function parseOverlay(overlay: CandidateOverlay): CandidateOverlay {
  const contentType = requireContentType(overlay.contentType);
  if (!overlay.contentKey) throw new ContentEditorError(400, "overlay contentKey is required");
  if (!overlay.draftVersionId)
    throw new ContentEditorError(400, "overlay draftVersionId is required");
  return { contentType, contentKey: overlay.contentKey, draftVersionId: overlay.draftVersionId };
}

function requireCandidateId(candidateId: string): void {
  if (!candidateId) throw new ContentEditorError(400, "candidate id is required");
}

async function pinOverlays(
  store: ContentEditorStore,
  base: readonly PinnedReleaseEntry[],
  overlays: readonly CandidateOverlay[],
): Promise<readonly PinnedReleaseEntry[]> {
  const byKey = new Map(base.map((entry) => [`${entry.contentType}:${entry.contentKey}`, entry]));
  const seen = new Set<string>();
  for (const overlay of overlays) {
    const key = `${overlay.contentType}:${overlay.contentKey}`;
    if (seen.has(key)) throw new ContentEditorError(400, `duplicate overlay ${key}`);
    seen.add(key);
    if (!byKey.has(key)) {
      throw new ContentEditorError(400, `content ${key} is not in the active release`);
    }
    const version = await store.findDraftVersion(overlay.draftVersionId);
    if (!version)
      throw new ContentEditorError(400, `draft version ${overlay.draftVersionId} is missing`);
    if (version.contentType !== overlay.contentType || version.contentKey !== overlay.contentKey) {
      throw new ContentEditorError(
        400,
        `draft version ${overlay.draftVersionId} does not belong to ${key}`,
      );
    }
    byKey.set(key, {
      contentType: overlay.contentType,
      contentKey: overlay.contentKey,
      draftVersionId: overlay.draftVersionId,
    });
  }
  return [...byKey.values()];
}

function validateDocuments(
  validator: ContentValidator,
  documents: Parameters<typeof assembleContentBundle>[0],
): readonly string[] {
  try {
    validator.validate(assembleContentBundle(documents));
    return [];
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues;
    throw error;
  }
}

function requireValidBundle(
  validator: ContentValidator,
  documents: Parameters<typeof assembleContentBundle>[0],
): ValidatedContentBundle {
  return validator.validate(assembleContentBundle(documents));
}

function toReportIssues(issues: readonly string[]): ValidationReportIssues {
  return {
    schema: 1,
    issues: issues.map((message) => ({ path: "bundle", message })),
  };
}

function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "document is invalid";
  const path = issue.path.length > 0 ? issue.path.join(".") : "document";
  return `${path}: ${issue.message}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error) return isUniqueViolation(error.cause);
  return false;
}
