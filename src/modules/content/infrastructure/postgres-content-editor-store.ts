import { and, desc, eq, max, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { PublishedRelease, ValidatedContentBundle } from "../domain/content-document.ts";
import { isContentType, type ContentType } from "../domain/parse-content-document.ts";
import type {
  ContentEditorCandidate,
  ContentEditorDraftVersion,
  ContentEditorReleaseEntry,
  ContentEditorValidationReport,
  ValidationReportIssues,
} from "../ports/content-editor.ts";
import type { ContentEditorStore, PinnedReleaseEntry } from "../ports/content-editor-store.ts";
import {
  activeRelease,
  candidateEntries,
  candidates,
  draftVersions,
  drafts,
  publicationAudits,
  releaseEntries,
  releaseVersionSeq,
  releases,
  validationReports,
} from "./schema.ts";

export class PostgresContentEditorStore implements ContentEditorStore {
  constructor(private readonly database: PostgresDatabase) {}

  async requireActiveRelease(): Promise<PublishedRelease> {
    const rows = await this.database
      .session()
      .select({
        id: releases.id,
        version: releases.version,
        checksum: releases.checksum,
      })
      .from(activeRelease)
      .innerJoin(releases, eq(activeRelease.releaseId, releases.id));
    if (rows.length !== 1) throw new Error("No published content revision");
    const row = rows[0];
    if (!row) throw new Error("No published content revision");
    return row;
  }

  async hasReleaseEntry(
    releaseId: string,
    contentType: ContentType,
    contentKey: string,
  ): Promise<boolean> {
    const rows = await this.database
      .session()
      .select({ contentKey: releaseEntries.contentKey })
      .from(releaseEntries)
      .where(
        and(
          eq(releaseEntries.releaseId, releaseId),
          eq(releaseEntries.contentType, contentType),
          eq(releaseEntries.contentKey, contentKey),
        ),
      );
    if (rows.length > 1) {
      throw new Error(`Multiple release entries for ${contentType}:${contentKey}`);
    }
    return rows.length === 1;
  }

  async listReleaseEntries(releaseId: string): Promise<readonly ContentEditorReleaseEntry[]> {
    const rows = await this.database
      .session()
      .select({
        contentType: releaseEntries.contentType,
        contentKey: releaseEntries.contentKey,
        draftVersionId: releaseEntries.draftVersionId,
      })
      .from(releaseEntries)
      .where(eq(releaseEntries.releaseId, releaseId));
    return rows.map(requireTypedEntry);
  }

  async maxDraftVersion(contentType: ContentType, contentKey: string): Promise<number> {
    const rows = await this.database
      .session()
      .select({ value: max(draftVersions.version) })
      .from(draftVersions)
      .innerJoin(drafts, eq(draftVersions.draftId, drafts.id))
      .where(and(eq(drafts.contentType, contentType), eq(drafts.contentKey, contentKey)));
    if (rows.length !== 1) {
      throw new Error(`Draft version lookup failed for ${contentType}:${contentKey}`);
    }
    const value = rows[0]?.value;
    if (value === null || value === undefined) {
      throw new Error(`No draft versions for ${contentType}:${contentKey}`);
    }
    return value;
  }

  async appendDraftVersion(input: {
    contentType: ContentType;
    contentKey: string;
    document: unknown;
    version: number;
    schemaVersion: string;
    createdBy: string;
  }): Promise<{ id: string; version: number }> {
    const session = this.database.session();
    const draftRows = await session
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(eq(drafts.contentType, input.contentType), eq(drafts.contentKey, input.contentKey)),
      );
    if (draftRows.length !== 1 || !draftRows[0]) {
      throw new Error(`Draft ${input.contentType}:${input.contentKey} is missing`);
    }
    const inserted = await session
      .insert(draftVersions)
      .values({
        draftId: draftRows[0].id,
        version: input.version,
        schemaVersion: input.schemaVersion,
        document: input.document,
        createdBy: input.createdBy,
        createdAt: sql`now()`,
      })
      .returning({ id: draftVersions.id, version: draftVersions.version });
    if (inserted.length !== 1 || !inserted[0]) {
      throw new Error(`Draft version insert failed for ${input.contentType}:${input.contentKey}`);
    }
    return inserted[0];
  }

  async findDraftVersion(id: string): Promise<ContentEditorDraftVersion | null> {
    const rows = await this.database
      .session()
      .select({
        id: draftVersions.id,
        contentType: drafts.contentType,
        contentKey: drafts.contentKey,
        document: draftVersions.document,
      })
      .from(draftVersions)
      .innerJoin(drafts, eq(draftVersions.draftId, drafts.id))
      .where(eq(draftVersions.id, id));
    if (rows.length > 1) throw new Error(`Multiple draft versions found for ${id}`);
    const row = rows[0];
    return row ? requireTypedVersion(row) : null;
  }

  async insertCandidate(input: {
    expectedActiveReleaseId: string;
    createdBy: string;
    entries: readonly PinnedReleaseEntry[];
  }): Promise<string> {
    const session = this.database.session();
    const inserted = await session
      .insert(candidates)
      .values({
        expectedActiveReleaseId: input.expectedActiveReleaseId,
        status: "open",
        createdBy: input.createdBy,
        createdAt: sql`now()`,
      })
      .returning({ id: candidates.id });
    const candidateId = inserted[0]?.id;
    if (inserted.length !== 1 || !candidateId)
      throw new Error("Candidate insert did not return an id");
    if (input.entries.length === 0) throw new Error("Candidate has no entries");
    await session.insert(candidateEntries).values(
      input.entries.map((entry) => ({
        candidateId,
        contentType: entry.contentType,
        contentKey: entry.contentKey,
        draftVersionId: entry.draftVersionId,
      })),
    );
    return candidateId;
  }

  async findCandidate(candidateId: string): Promise<ContentEditorCandidate | null> {
    const rows = await this.database
      .session()
      .select({
        id: candidates.id,
        expectedActiveReleaseId: candidates.expectedActiveReleaseId,
        status: candidates.status,
      })
      .from(candidates)
      .where(eq(candidates.id, candidateId));
    if (rows.length > 1) throw new Error(`Multiple candidates found for ${candidateId}`);
    const row = rows[0];
    if (!row) return null;
    return { ...row, status: requireCandidateStatus(row.status) };
  }

  async listCandidateEntries(candidateId: string): Promise<readonly PinnedReleaseEntry[]> {
    const rows = await this.database
      .session()
      .select({
        contentType: candidateEntries.contentType,
        contentKey: candidateEntries.contentKey,
        draftVersionId: candidateEntries.draftVersionId,
      })
      .from(candidateEntries)
      .where(eq(candidateEntries.candidateId, candidateId));
    return rows.map(requireTypedEntry);
  }

  async listCandidateDocuments(candidateId: string): Promise<readonly ContentEditorDraftVersion[]> {
    const rows = await this.database
      .session()
      .select({
        id: draftVersions.id,
        contentType: drafts.contentType,
        contentKey: drafts.contentKey,
        document: draftVersions.document,
      })
      .from(candidateEntries)
      .innerJoin(draftVersions, eq(candidateEntries.draftVersionId, draftVersions.id))
      .innerJoin(drafts, eq(draftVersions.draftId, drafts.id))
      .where(eq(candidateEntries.candidateId, candidateId));
    return rows.map(requireTypedVersion);
  }

  async setCandidateStatus(
    candidateId: string,
    status: ContentEditorCandidate["status"],
  ): Promise<void> {
    const updated = await this.database
      .session()
      .update(candidates)
      .set({ status })
      .where(eq(candidates.id, candidateId))
      .returning({ id: candidates.id });
    if (updated.length !== 1) throw new Error(`Candidate ${candidateId} status update failed`);
  }

  async insertValidationReport(input: {
    candidateId: string;
    validatorVersion: string;
    ok: boolean;
    issues: ValidationReportIssues;
  }): Promise<string> {
    if (input.issues.schema !== 1) throw new Error("validation report schema must be 1");
    const inserted = await this.database
      .session()
      .insert(validationReports)
      .values({
        candidateId: input.candidateId,
        validatorVersion: input.validatorVersion,
        ok: input.ok ? 1 : 0,
        issues: input.issues,
        createdAt: sql`now()`,
      })
      .returning({ id: validationReports.id });
    const id = inserted[0]?.id;
    if (inserted.length !== 1 || !id)
      throw new Error("Validation report insert did not return an id");
    return id;
  }

  async latestValidationReport(candidateId: string): Promise<ContentEditorValidationReport | null> {
    const rows = await this.database
      .session()
      .select({ id: validationReports.id, ok: validationReports.ok })
      .from(validationReports)
      .where(eq(validationReports.candidateId, candidateId))
      .orderBy(desc(validationReports.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.ok !== 0 && row.ok !== 1) throw new Error(`Validation report ${row.id} has invalid ok`);
    return { id: row.id, ok: row.ok === 1 };
  }

  async persistPinnedBundle(
    bundle: ValidatedContentBundle,
    pinned: readonly PinnedReleaseEntry[],
  ): Promise<PublishedRelease> {
    if (
      releaseVersionSeq.schema !== "content" ||
      releaseVersionSeq.seqName !== "release_version_seq"
    ) {
      throw new Error("content.release_version_seq is misconfigured");
    }
    const pinByKey = new Map(
      pinned.map((entry) => [`${entry.contentType}:${entry.contentKey}`, entry.draftVersionId]),
    );
    if (pinByKey.size !== pinned.length) throw new Error("Candidate has duplicate entries");
    if (pinByKey.size !== bundle.entries.length) {
      throw new Error("Pinned versions do not match the validated bundle");
    }
    const entryRows = bundle.entries.map((entry) => {
      const draftVersionId = pinByKey.get(`${entry.type}:${entry.key}`);
      if (!draftVersionId) {
        throw new Error(`Pinned version missing for ${entry.type}:${entry.key}`);
      }
      return {
        contentType: entry.type,
        contentKey: entry.key,
        draftVersionId,
        digest: entry.digest,
      };
    });
    const session = this.database.session();
    const releaseRows = await session
      .insert(releases)
      .values({
        checksum: bundle.checksum,
        schemaVersion: bundle.schemaVersion,
        validatorVersion: bundle.validatorVersion,
        createdAt: sql`now()`,
      })
      .returning({ id: releases.id, version: releases.version, checksum: releases.checksum });
    if (releaseRows.length !== 1 || !releaseRows[0]) {
      throw new Error("Release insert did not return an id");
    }
    const release = releaseRows[0];
    await session
      .insert(releaseEntries)
      .values(entryRows.map((entry) => ({ ...entry, releaseId: release.id })));
    return release;
  }

  async recordPublicationAudit(input: {
    releaseId: string;
    candidateId: string;
    createdBy: string;
  }): Promise<void> {
    await this.database
      .session()
      .insert(publicationAudits)
      .values({
        releaseId: input.releaseId,
        candidateId: input.candidateId,
        createdBy: input.createdBy,
        createdAt: sql`now()`,
      });
  }
}

function requireTypedEntry(row: {
  contentType: string;
  contentKey: string;
  draftVersionId: string;
}): ContentEditorReleaseEntry {
  if (!isContentType(row.contentType)) {
    throw new Error(`Unknown content type ${row.contentType}`);
  }
  return {
    contentType: row.contentType,
    contentKey: row.contentKey,
    draftVersionId: row.draftVersionId,
  };
}

function requireTypedVersion(row: {
  id: string;
  contentType: string;
  contentKey: string;
  document: unknown;
}): ContentEditorDraftVersion {
  if (!isContentType(row.contentType)) {
    throw new Error(`Unknown content type ${row.contentType}`);
  }
  return {
    id: row.id,
    contentType: row.contentType,
    contentKey: row.contentKey,
    document: row.document,
  };
}

function requireCandidateStatus(status: string): ContentEditorCandidate["status"] {
  if (
    status === "open" ||
    status === "validated" ||
    status === "invalid" ||
    status === "activated"
  ) {
    return status;
  }
  throw new Error(`Unknown candidate status ${status}`);
}
