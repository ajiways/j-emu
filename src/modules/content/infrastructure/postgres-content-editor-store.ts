import { and, eq, sql } from "drizzle-orm";
import type { PublishedRelease, ValidatedContentBundle } from "../domain/content-document.ts";
import type { ContentType } from "../domain/parse-content-document.ts";
import type { ContentEditorCandidate, ValidationReportIssues } from "../ports/content-editor.ts";
import type { ContentEditorStore, PinnedReleaseEntry } from "../ports/content-editor-store.ts";
import { PostgresContentEditorReadStore } from "./postgres-content-editor-read-store.ts";
import {
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

export class PostgresContentEditorStore
  extends PostgresContentEditorReadStore
  implements ContentEditorStore
{
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
