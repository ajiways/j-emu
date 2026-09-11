import { and, eq, max, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { PublishedRelease, ValidatedContentBundle } from "../domain/content-document.ts";
import type { ContentStore } from "../ports/content-store.ts";
import {
  activeRelease,
  bootstrapImports,
  draftVersions,
  drafts,
  releaseEntries,
  releaseVersionSeq,
  releases,
} from "./schema.ts";

export class PostgresContentStore implements ContentStore {
  constructor(private readonly database: PostgresDatabase) {}

  async lockPublication(): Promise<string | null> {
    const rows = await this.database.session().select().from(activeRelease).for("update");
    if (rows.length !== 1) throw new Error("content.active_release singleton is missing");
    const row = rows[0];
    if (!row) throw new Error("content.active_release singleton is missing");
    return row.releaseId;
  }

  async findBootstrap(digest: string): Promise<PublishedRelease | null> {
    const rows = await this.database
      .session()
      .select({
        id: releases.id,
        version: releases.version,
        checksum: releases.checksum,
      })
      .from(bootstrapImports)
      .innerJoin(releases, eq(bootstrapImports.releaseId, releases.id))
      .where(eq(bootstrapImports.digest, digest));
    return this.singleRelease(rows, `bootstrap digest ${digest}`);
  }

  async hasAnyRelease(): Promise<boolean> {
    const rows = await this.database.session().select({ id: releases.id }).from(releases).limit(1);
    return rows.length > 0;
  }

  async findByChecksum(checksum: string): Promise<PublishedRelease | null> {
    const rows = await this.database
      .session()
      .select({ id: releases.id, version: releases.version, checksum: releases.checksum })
      .from(releases)
      .where(eq(releases.checksum, checksum));
    return this.singleRelease(rows, `checksum ${checksum}`);
  }

  async persistValidatedBundle(bundle: ValidatedContentBundle): Promise<PublishedRelease> {
    if (
      releaseVersionSeq.schema !== "content" ||
      releaseVersionSeq.seqName !== "release_version_seq"
    ) {
      throw new Error("content.release_version_seq is misconfigured");
    }
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
    const release = this.singleRelease(releaseRows, "new release");
    if (!release) throw new Error("Release insert did not return an id");
    const entryRows = [];
    for (const entry of bundle.entries) {
      const draftId = await this.requireDraftId(entry.type, entry.key);
      const versionRows = await session
        .select({ value: max(draftVersions.version) })
        .from(draftVersions)
        .where(eq(draftVersions.draftId, draftId));
      const current = versionRows[0]?.value;
      const nextVersion = current === null || current === undefined ? 1 : current + 1;
      const versionInsert = await session
        .insert(draftVersions)
        .values({
          draftId,
          version: nextVersion,
          schemaVersion: bundle.schemaVersion,
          document: entry.document,
          createdBy: "bootstrap",
          createdAt: sql`now()`,
        })
        .returning({ id: draftVersions.id });
      const draftVersionId = versionInsert[0]?.id;
      if (versionInsert.length !== 1 || !draftVersionId) {
        throw new Error(`Draft version insert failed for ${entry.type}:${entry.key}`);
      }
      entryRows.push({
        releaseId: release.id,
        contentType: entry.type,
        contentKey: entry.key,
        draftVersionId,
        digest: entry.digest,
      });
    }
    if (entryRows.length > 0) await session.insert(releaseEntries).values(entryRows);
    return release;
  }

  async activate(releaseId: string): Promise<void> {
    const session = this.database.session();
    await session
      .update(releases)
      .set({ activatedAt: sql`now()` })
      .where(eq(releases.id, releaseId));
    await session
      .update(activeRelease)
      .set({ releaseId, activatedAt: sql`now()` })
      .where(eq(activeRelease.lockId, 1));
  }

  async recordBootstrap(digest: string, releaseId: string, source: string): Promise<void> {
    await this.database
      .session()
      .insert(bootstrapImports)
      .values({
        digest,
        releaseId,
        source,
        appliedAt: sql`now()`,
      });
  }

  private async requireDraftId(contentType: string, contentKey: string): Promise<string> {
    const session = this.database.session();
    const existing = await session
      .select({ id: drafts.id })
      .from(drafts)
      .where(and(eq(drafts.contentType, contentType), eq(drafts.contentKey, contentKey)));
    if (existing.length > 1) {
      throw new Error(`Multiple drafts found for ${contentType}:${contentKey}`);
    }
    const found = existing[0]?.id;
    if (found) return found;
    const inserted = await session
      .insert(drafts)
      .values({ contentType, contentKey })
      .returning({ id: drafts.id });
    const id = inserted[0]?.id;
    if (inserted.length !== 1 || !id) {
      throw new Error(`Draft insert failed for ${contentType}:${contentKey}`);
    }
    return id;
  }

  private singleRelease(
    rows: Array<{ id: string; version: number; checksum: string }>,
    key: string,
  ): PublishedRelease | null {
    if (rows.length > 1) throw new Error(`Multiple releases found for ${key}`);
    const row = rows[0];
    return row ?? null;
  }
}
