import { describe, expect, it } from "vitest";
import { ContentEditorService } from "../../../src/modules/content/application/content-editor-service.ts";
import { ContentActivationCompatibility } from "../../../src/modules/content/application/content-activation-compatibility.ts";
import { ContentMaterializer } from "../../../src/modules/content/application/content-materializer.ts";
import { ContentValidator } from "../../../src/modules/content/application/content-validator.ts";
import type { CatalogCompatibility } from "../../../src/modules/catalog/ports/catalog-compatibility.ts";
import type { CatalogProjection } from "../../../src/modules/catalog/ports/catalog-projection.ts";
import type { FarmStockProjection } from "../../../src/modules/professions/ports/farm-stock-projection.ts";
import type { QuestProjection } from "../../../src/modules/quests/ports/quest-projection.ts";
import type { WorldProjection } from "../../../src/modules/world/ports/world-projection.ts";
import type { ContentStore } from "../../../src/modules/content/ports/content-store.ts";
import type { ContentEditorStore } from "../../../src/modules/content/ports/content-editor-store.ts";
import type { ContentEditorDraftVersion } from "../../../src/modules/content/ports/content-editor.ts";
import type { PublishedRelease } from "../../../src/modules/content/domain/content-document.ts";
import type { UnitOfWork } from "../../../src/shared/kernel/unit-of-work.ts";
import path from "node:path";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));
const npc = playable.npcs.find((row) => row.id === 271);
if (!npc) throw new Error("playable slice is missing NPC 271");

describe("ContentEditorService saveDraft", () => {
  it("rejects a stale expectedVersion", async () => {
    const store = new MemoryEditorStore();
    const editor = new ContentEditorService(
      passthroughUow,
      unusedPublication,
      store,
      new ContentValidator(),
      new ContentActivationCompatibility(),
      unusedCompatibility,
      new ContentMaterializer(unusedCatalog, unusedWorld, unusedFarms, unusedQuests),
    );
    await expect(
      editor.saveDraft({
        contentType: "npc",
        contentKey: "271",
        document: { ...npc, title: "Другой" },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(store.appended).toBe(0);
  });

  it("appends when expectedVersion matches the current max", async () => {
    const store = new MemoryEditorStore();
    const editor = new ContentEditorService(
      passthroughUow,
      unusedPublication,
      store,
      new ContentValidator(),
      new ContentActivationCompatibility(),
      unusedCompatibility,
      new ContentMaterializer(unusedCatalog, unusedWorld, unusedFarms, unusedQuests),
    );
    const saved = await editor.saveDraft({
      contentType: "npc",
      contentKey: "271",
      document: { ...npc, title: "Другой" },
      expectedVersion: 2,
    });
    expect(saved.version).toBe(3);
    expect(store.appended).toBe(1);
  });
});

const passthroughUow: UnitOfWork = {
  run: (work) => work(),
};

const unusedPublication = {} as ContentStore;
const unusedCompatibility = {} as CatalogCompatibility;
const unusedCatalog = {} as CatalogProjection;
const unusedWorld = {} as WorldProjection;
const unusedFarms = {} as FarmStockProjection;
const unusedQuests = {} as QuestProjection;

class MemoryEditorStore implements ContentEditorStore {
  appended = 0;
  private readonly active: PublishedRelease = {
    id: "active-1",
    version: 1,
    checksum: "abc",
  };

  async requireActiveRelease(): Promise<PublishedRelease> {
    return this.active;
  }

  async hasReleaseEntry(): Promise<boolean> {
    return true;
  }

  async listReleaseEntries() {
    return [];
  }

  async maxDraftVersion(): Promise<number> {
    return 2;
  }

  async appendDraftVersion(input: { version: number }): Promise<{ id: string; version: number }> {
    this.appended += 1;
    return { id: "draft-v", version: input.version };
  }

  async findDraftVersion(): Promise<ContentEditorDraftVersion | null> {
    return null;
  }

  async insertCandidate(): Promise<string> {
    throw new Error("not used");
  }

  async findCandidate() {
    return null;
  }

  async listCandidateEntries() {
    return [];
  }

  async listCandidateDocuments() {
    return [];
  }

  async setCandidateStatus(): Promise<void> {}

  async insertValidationReport(): Promise<string> {
    throw new Error("not used");
  }

  async latestValidationReport() {
    return null;
  }

  async persistPinnedBundle(): Promise<PublishedRelease> {
    throw new Error("not used");
  }

  async recordPublicationAudit(): Promise<void> {}
}
