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

export const contentSchema = pgSchema("content");

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
      sql`${table.contentType} IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'craft_recipe', 'npc', 'quest', 'world_fact', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message')`,
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
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("draft_versions_draft_id_version_unique").on(table.draftId, table.version),
    check("draft_versions_version_check", sql`${table.version} > 0`),
    check("draft_versions_created_by_check", sql`${table.createdBy} <> ''`),
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

export const candidates = contentSchema.table(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expectedActiveReleaseId: uuid("expected_active_release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    check(
      "candidates_status_check",
      sql`${table.status} IN ('open', 'validated', 'invalid', 'activated')`,
    ),
    check("candidates_created_by_check", sql`${table.createdBy} <> ''`),
  ],
);

export const candidateEntries = contentSchema.table(
  "candidate_entries",
  {
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    contentType: text("content_type").notNull(),
    contentKey: text("content_key").notNull(),
    draftVersionId: uuid("draft_version_id")
      .notNull()
      .references(() => draftVersions.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.candidateId, table.contentType, table.contentKey] }),
    check(
      "candidate_entries_content_type_check",
      sql`${table.contentType} IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'craft_recipe', 'npc', 'quest', 'world_fact', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message')`,
    ),
  ],
);

export const validationReports = contentSchema.table(
  "validation_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    validatorVersion: text("validator_version").notNull(),
    ok: smallint("ok").notNull(),
    issues: jsonb("issues").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    check("validation_reports_ok_check", sql`${table.ok} IN (0, 1)`),
    check(
      "validation_reports_issues_size_check",
      sql`octet_length(${table.issues}::text) <= 1048576`,
    ),
  ],
);

export const publicationAudits = contentSchema.table(
  "publication_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [check("publication_audits_created_by_check", sql`${table.createdBy} <> ''`)],
);
