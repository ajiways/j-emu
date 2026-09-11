import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { ContentEditorError } from "../../../src/modules/content/application/content-editor-error.ts";
import {
  createPostgresContentEditor,
  createPostgresContentPublication,
} from "../../../src/modules/content/infrastructure/create-postgres-content-publication.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { draftVersions, drafts } from "../../../src/modules/content/infrastructure/schema.ts";
import { and, eq } from "drizzle-orm";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();
const playablePath = path.resolve(process.cwd(), "content/playable-slice.json");
const playable = loadContentBundleFile(playablePath);
const npc = playable.npcs.find((row) => row.id === 271);
const quest = playable.quests.find((row) => row.key === "q_engine_board");
if (!npc) throw new Error("playable slice is missing NPC 271");
if (!quest) throw new Error("playable slice is missing q_engine_board");

describe("content editor", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
    await createPostgresContentPublication(database).seed(playable, playablePath);
  });

  afterAll(async () => {
    await database.close();
  });

  it("persists an operator draft version", async () => {
    const editor = createPostgresContentEditor(database);
    const saved = await editor.saveDraft({
      contentType: "npc",
      contentKey: "271",
      document: { ...npc, title: "Черновик NPC" },
      expectedVersion: await currentVersion(database, "npc", "271"),
    });
    expect(saved.version).toBeGreaterThan(1);
    const rows = await database
      .session()
      .select({
        version: draftVersions.version,
        createdBy: draftVersions.createdBy,
        document: draftVersions.document,
      })
      .from(draftVersions)
      .where(eq(draftVersions.id, saved.draftVersionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      version: saved.version,
      createdBy: "operator",
      document: expect.objectContaining({ id: 271, title: "Черновик NPC" }),
    });
  });

  it("reads the pinned active document and lists keys without creating a draft", async () => {
    const editor = createPostgresContentEditor(database);
    const document = await editor.readDocument({ contentType: "npc", contentKey: "271" });
    expect(document.version).toBeGreaterThanOrEqual(1);
    expect(document.draftVersionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(document.document).toMatchObject({ id: 271 });
    const keys = await editor.listKeys("store_lot");
    expect(keys.keys).toEqual(expect.arrayContaining(["504:80"]));
    await expect(
      editor.readDocument({ contentType: "npc", contentKey: "999" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reactivates the bootstrap release when seed matches the file checksum", async () => {
    const editor = createPostgresContentEditor(database);
    const publication = createPostgresContentPublication(database);
    const bootstrap = await publication.seed(playable, playablePath);
    const saved = await saveNpcTitle(
      editor,
      "Временный editor title",
      await currentVersion(database, "npc", "271"),
    );
    const built = await editor.buildCandidate({
      expectedActiveReleaseId: (await editor.status()).id,
      overlays: [{ contentType: "npc", contentKey: "271", draftVersionId: saved.draftVersionId }],
    });
    expect((await editor.validateCandidate(built.candidateId)).ok).toBe(true);
    const activated = await editor.activateCandidate(built.candidateId);
    expect(activated.releaseId).not.toBe(bootstrap.id);
    const restored = await publication.seed(playable, playablePath);
    expect(restored.id).toBe(bootstrap.id);
    expect(await editor.status()).toMatchObject({ id: bootstrap.id });
    const document = await editor.readDocument({ contentType: "npc", contentKey: "271" });
    expect(document.document).toMatchObject({ id: 271, title: npc.title });
  });

  it("does not move the active pointer when validation fails", async () => {
    const editor = createPostgresContentEditor(database);
    const before = await editor.status();
    const saved = await editor.saveDraft({
      contentType: "quest",
      contentKey: "q_engine_board",
      document: { ...quest, npcId: 99999 },
      expectedVersion: await currentVersion(database, "quest", "q_engine_board"),
    });
    const built = await editor.buildCandidate({
      expectedActiveReleaseId: before.id,
      overlays: [
        {
          contentType: "quest",
          contentKey: "q_engine_board",
          draftVersionId: saved.draftVersionId,
        },
      ],
    });
    const report = await editor.validateCandidate(built.candidateId);
    expect(report.ok).toBe(false);
    await expect(editor.activateCandidate(built.candidateId)).rejects.toMatchObject({
      status: 422,
      reportId: report.reportId,
    });
    expect(await editor.status()).toEqual(before);
  });

  it("lets only one concurrent activate commit", async () => {
    const firstClient = new PostgresDatabase(databaseUrl);
    const secondClient = new PostgresDatabase(databaseUrl);
    try {
      const baseline = createPostgresContentEditor(database);
      const active = await baseline.status();
      const firstVersion = await saveNpcTitle(
        baseline,
        "Первый concurrent",
        await currentVersion(database, "npc", "271"),
      );
      const secondVersion = await saveNpcTitle(baseline, "Второй concurrent", firstVersion.version);
      const first = createPostgresContentEditor(firstClient);
      const second = createPostgresContentEditor(secondClient);
      const firstCandidate = await first.buildCandidate({
        expectedActiveReleaseId: active.id,
        overlays: [
          { contentType: "npc", contentKey: "271", draftVersionId: firstVersion.draftVersionId },
        ],
      });
      const secondCandidate = await second.buildCandidate({
        expectedActiveReleaseId: active.id,
        overlays: [
          { contentType: "npc", contentKey: "271", draftVersionId: secondVersion.draftVersionId },
        ],
      });
      expect((await first.validateCandidate(firstCandidate.candidateId)).ok).toBe(true);
      expect((await second.validateCandidate(secondCandidate.candidateId)).ok).toBe(true);
      const results = await Promise.allSettled([
        first.activateCandidate(firstCandidate.candidateId),
        second.activateCandidate(secondCandidate.candidateId),
      ]);
      const accepted = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const failure = rejected[0];
      if (!failure || failure.status !== "rejected")
        throw new Error("expected a rejected activate");
      expect(failure.reason).toBeInstanceOf(ContentEditorError);
      expect(failure.reason).toMatchObject({ status: 409 });
      const winner = accepted[0];
      if (!winner || winner.status !== "fulfilled") throw new Error("expected a winning activate");
      expect(await baseline.status()).toMatchObject({ id: winner.value.releaseId });
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
  });
});

async function currentVersion(
  database: PostgresDatabase,
  contentType: string,
  contentKey: string,
): Promise<number> {
  const rows = await database
    .session()
    .select({ version: draftVersions.version })
    .from(draftVersions)
    .innerJoin(drafts, eq(draftVersions.draftId, drafts.id))
    .where(and(eq(drafts.contentType, contentType), eq(drafts.contentKey, contentKey)));
  const versions = rows.map((row) => row.version);
  if (versions.length === 0) throw new Error(`No draft versions for ${contentType}:${contentKey}`);
  return Math.max(...versions);
}

async function saveNpcTitle(
  editor: ReturnType<typeof createPostgresContentEditor>,
  title: string,
  expectedVersion: number,
) {
  return editor.saveDraft({
    contentType: "npc",
    contentKey: "271",
    document: { ...npc, title },
    expectedVersion,
  });
}
