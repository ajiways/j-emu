import { and, asc, desc, eq, max } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { PublishedRelease } from "../domain/content-document.ts";
import { isContentType, type ContentType } from "../domain/parse-content-document.ts";
import type {
  ContentEditorCandidate,
  ContentEditorDocument,
  ContentEditorDraftVersion,
  ContentEditorReleaseEntry,
  ContentEditorValidationReport,
} from "../ports/content-editor.ts";
import {
  activeRelease,
  candidateEntries,
  candidates,
  draftVersions,
  drafts,
  releaseEntries,
  releases,
  validationReports,
} from "./schema.ts";

export class PostgresContentEditorReadStore {
  constructor(protected readonly database: PostgresDatabase) {}

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

  async readDocument(
    contentType: ContentType,
    contentKey: string,
  ): Promise<ContentEditorDocument | null> {
    const active = await this.requireActiveRelease();
    const rows = await this.database
      .session()
      .select({
        draftVersionId: releaseEntries.draftVersionId,
        document: draftVersions.document,
      })
      .from(releaseEntries)
      .innerJoin(draftVersions, eq(draftVersions.id, releaseEntries.draftVersionId))
      .where(
        and(
          eq(releaseEntries.releaseId, active.id),
          eq(releaseEntries.contentType, contentType),
          eq(releaseEntries.contentKey, contentKey),
        ),
      );
    if (rows.length > 1) {
      throw new Error(`Multiple release entries for ${contentType}:${contentKey}`);
    }
    const row = rows[0];
    if (!row) return null;
    return {
      document: row.document,
      version: await this.maxDraftVersion(contentType, contentKey),
      draftVersionId: row.draftVersionId,
    };
  }

  async listKeys(contentType: ContentType): Promise<readonly string[]> {
    const active = await this.requireActiveRelease();
    const rows = await this.database
      .session()
      .select({ contentKey: releaseEntries.contentKey })
      .from(releaseEntries)
      .where(
        and(eq(releaseEntries.releaseId, active.id), eq(releaseEntries.contentType, contentType)),
      )
      .orderBy(asc(releaseEntries.contentKey));
    return rows.map((row) => row.contentKey);
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

  async listCandidateEntries(candidateId: string) {
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
