import { eq, max, sql } from "drizzle-orm";
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

const INSERT_BATCH = 250;

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
    const draftIds = await this.ensureDraftIds(bundle.entries);
    const nextVersion = await this.nextDraftVersions(draftIds);
    const versionValues = bundle.entries.map((entry) => {
      const draftId = draftIds.get(`${entry.type}:${entry.key}`);
      if (!draftId) throw new Error(`Draft id missing for ${entry.type}:${entry.key}`);
      const version = nextVersion.get(draftId);
      if (version === undefined)
        throw new Error(`Draft version missing for ${entry.type}:${entry.key}`);
      return {
        draftId,
        version,
        schemaVersion: bundle.schemaVersion,
        document: entry.document,
        createdBy: "bootstrap",
        createdAt: sql`now()`,
        type: entry.type,
        key: entry.key,
        digest: entry.digest,
      };
    });
    const versionIds = new Map<string, string>();
    for (let offset = 0; offset < versionValues.length; offset += INSERT_BATCH) {
      const batch = versionValues.slice(offset, offset + INSERT_BATCH);
      const inserted = await session
        .insert(draftVersions)
        .values(
          batch.map((row) => ({
            draftId: row.draftId,
            version: row.version,
            schemaVersion: row.schemaVersion,
            document: row.document,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
          })),
        )
        .returning({ id: draftVersions.id, draftId: draftVersions.draftId });
      if (inserted.length !== batch.length) {
        throw new Error("Draft version batch insert returned a different row count");
      }
      for (const row of inserted) {
        versionIds.set(row.draftId, row.id);
      }
    }
    const entryRows = bundle.entries.map((entry) => {
      const draftId = draftIds.get(`${entry.type}:${entry.key}`);
      if (!draftId) throw new Error(`Draft id missing for ${entry.type}:${entry.key}`);
      const draftVersionId = versionIds.get(draftId);
      if (!draftVersionId) {
        throw new Error(`Draft version insert failed for ${entry.type}:${entry.key}`);
      }
      return {
        releaseId: release.id,
        contentType: entry.type,
        contentKey: entry.key,
        draftVersionId,
        digest: entry.digest,
      };
    });
    for (let offset = 0; offset < entryRows.length; offset += INSERT_BATCH) {
      await session.insert(releaseEntries).values(entryRows.slice(offset, offset + INSERT_BATCH));
    }
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

  private async ensureDraftIds(
    entries: readonly { type: string; key: string }[],
  ): Promise<Map<string, string>> {
    const session = this.database.session();
    const existing = await session
      .select({
        id: drafts.id,
        contentType: drafts.contentType,
        contentKey: drafts.contentKey,
      })
      .from(drafts);
    const byKey = new Map(existing.map((row) => [`${row.contentType}:${row.contentKey}`, row.id]));
    if (existing.length !== byKey.size) throw new Error("Duplicate drafts found");
    const missing = entries.filter((entry) => !byKey.has(`${entry.type}:${entry.key}`));
    const uniqueMissing = [];
    const seen = new Set<string>();
    for (const entry of missing) {
      const key = `${entry.type}:${entry.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueMissing.push({ contentType: entry.type, contentKey: entry.key });
    }
    for (let offset = 0; offset < uniqueMissing.length; offset += INSERT_BATCH) {
      const batch = uniqueMissing.slice(offset, offset + INSERT_BATCH);
      const inserted = await session.insert(drafts).values(batch).returning({
        id: drafts.id,
        contentType: drafts.contentType,
        contentKey: drafts.contentKey,
      });
      if (inserted.length !== batch.length) {
        throw new Error("Draft batch insert returned a different row count");
      }
      for (const row of inserted) {
        byKey.set(`${row.contentType}:${row.contentKey}`, row.id);
      }
    }
    return byKey;
  }

  private async nextDraftVersions(
    draftIds: ReadonlyMap<string, string>,
  ): Promise<Map<string, number>> {
    const session = this.database.session();
    const ids = [...new Set(draftIds.values())];
    const current = new Map<string, number>();
    if (ids.length > 0) {
      const rows = await session
        .select({ draftId: draftVersions.draftId, value: max(draftVersions.version) })
        .from(draftVersions)
        .groupBy(draftVersions.draftId);
      for (const row of rows) {
        if (row.value !== null && row.value !== undefined) current.set(row.draftId, row.value);
      }
    }
    const next = new Map<string, number>();
    for (const id of ids) {
      const value = current.get(id);
      next.set(id, value === undefined ? 1 : value + 1);
    }
    return next;
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
