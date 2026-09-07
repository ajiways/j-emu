import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const contentSchema = pgSchema("content");

export const releaseVersionSeq = contentSchema.sequence("release_version_seq", {
  startWith: 1,
  cycle: false,
});

export const drafts = contentSchema.table(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentType: text("content_type").notNull(),
    contentKey: text("content_key").notNull(),
  },
  (table) => [
    unique("drafts_type_key_unique").on(table.contentType, table.contentKey),
    check(
      "drafts_content_type_check",
      sql`${table.contentType} IN ('artifact', 'bot', 'area', 'hunt_spawn')`,
    ),
  ],
);

export const draftVersions = contentSchema.table(
  "draft_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    document: jsonb("document").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("draft_versions_draft_id_version_unique").on(table.draftId, table.version),
    check("draft_versions_version_check", sql`${table.version} > 0`),
    check(
      "draft_versions_document_size_check",
      sql`octet_length(${table.document}::text) <= 1048576`,
    ),
  ],
);

export const releases = contentSchema.table("releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version")
    .notNull()
    .unique()
    .default(sql`nextval('content.release_version_seq'::regclass)`),
  checksum: text("checksum").notNull().unique(),
  schemaVersion: text("schema_version").notNull(),
  validatorVersion: text("validator_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
});

export const releaseEntries = contentSchema.table(
  "release_entries",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    contentType: text("content_type").notNull(),
    contentKey: text("content_key").notNull(),
    draftVersionId: uuid("draft_version_id")
      .notNull()
      .references(() => draftVersions.id, { onDelete: "restrict" }),
    digest: text("digest").notNull(),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.contentType, table.contentKey] })],
);

export const activeRelease = contentSchema.table(
  "active_release",
  {
    lockId: smallint("lock_id").primaryKey().default(1),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "restrict" }),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [check("active_release_singleton", sql`${table.lockId} = 1`)],
);

export const bootstrapImports = contentSchema.table("bootstrap_imports", {
  digest: text("digest").primaryKey(),
  releaseId: uuid("release_id")
    .notNull()
    .references(() => releases.id, { onDelete: "restrict" }),
  source: text("source").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }).notNull(),
});
