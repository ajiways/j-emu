import path from "node:path";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { parseDraftDocument } from "../../../src/modules/content/domain/parse-content-document.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

describe("parseDraftDocument", () => {
  it("rejects unknown keys on an NPC document", () => {
    const npc = playable.npcs.find((row) => row.id === 271);
    if (!npc) throw new Error("playable slice is missing NPC 271");
    expect(() => parseDraftDocument("npc", { ...npc, extra: true })).toThrow(ZodError);
  });

  it("rejects a quest document without flags", () => {
    const quest = playable.quests.find((row) => row.key === "q_engine_board");
    if (!quest) throw new Error("playable slice is missing q_engine_board");
    const withoutFlags: Record<string, unknown> = { ...quest };
    delete withoutFlags.flags;
    expect(() => parseDraftDocument("quest", withoutFlags)).toThrow(/flags/);
  });
});
