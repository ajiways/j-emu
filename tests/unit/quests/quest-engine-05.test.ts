import { describe, expect, it } from "vitest";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";
import { requireStoreAreaCode } from "../../../src/app/come-in-travel.ts";
import path from "node:path";
import { ZodError } from "zod";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { parseDraftDocument } from "../../../src/modules/content/domain/parse-content-document.ts";
import { ContentValidator } from "../../../src/modules/content/application/content-validator.ts";
import type { ContentBundle } from "../../../src/modules/content/domain/content-document.ts";
import type { QuestDocument } from "../../../src/modules/content/domain/content-quest.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

describe("QST-ENG-05 OPEN_STORE parse and validator", () => {
  it("rejects a player OPEN_STORE without areaId", () => {
    const quest = storeQuest();
    expect(() =>
      parseDraftDocument("quest", {
        ...quest,
        dialogSteps: quest.dialogSteps.map((step) =>
          step.type === "player" ? { ...step, scripts: [{ type: "OPEN_STORE" }] } : step,
        ),
      }),
    ).toThrow(ZodError);
  });

  it("rejects OPEN_STORE to an area that is not a store", () => {
    expect(() => new ContentValidator().validate(withStoreAreaId(503))).toThrow(
      /OPEN_STORE area 503 is not a store/,
    );
  });

  it("rejects OPEN_STORE to a missing area", () => {
    expect(() => new ContentValidator().validate(withStoreAreaId(1))).toThrow(
      /OPEN_STORE area 1 is missing/,
    );
  });

  it("returns 204 when the destination area is not a store", () => {
    expect(() => requireStoreAreaCode({ id: "503", code: "village" })).toThrow(ProtocolError);
    try {
      requireStoreAreaCode({ id: "503", code: "village" });
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolError);
      if (error instanceof ProtocolError) {
        expect(error.status).toBe(204);
        expect(error.message).toBe("area 503 is not a store");
      }
    }
  });
});

function storeQuest(): QuestDocument {
  const quest = playable.quests.find((row) => row.key === "q_engine_store");
  if (!quest) throw new Error("playable slice is missing q_engine_store");
  return quest;
}

function withStoreAreaId(areaId: number): ContentBundle {
  return {
    ...playable,
    quests: playable.quests.map((quest) =>
      quest.key === "q_engine_store"
        ? {
            ...quest,
            dialogSteps: quest.dialogSteps.map((step) =>
              step.type === "player"
                ? { ...step, scripts: [{ type: "OPEN_STORE", areaId }] }
                : step,
            ),
          }
        : quest,
    ),
  };
}
