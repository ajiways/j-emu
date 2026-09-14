import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const E2E_ARTIKUL_IDS = [
  9095, 20, 21, 26, 9098, 9100, 9099, 93, 99, 77, 23, 24, 621, 553, 1310, 4603, 11408, 13224, 27,
  28, 30, 33, 35, 106, 43, 46, 640, 623, 2371, 55, 584, 1720, 1721, 1722, 1861, 1714, 20546, 5986,
] as const;

describe("Pub1 generated item corpus", () => {
  const artifacts = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content/pub1-items.generated.json"), "utf8"),
  ) as Array<{
    id: number;
    title: string;
    extra: { spell?: { groupId?: number }; spells?: unknown; hits?: unknown };
  }>;
  const byId = new Map(artifacts.map((row) => [row.id, row]));

  it("keeps wire IDs of e2e artifacts", () => {
    expect(artifacts).toHaveLength(22560);
    for (const id of E2E_ARTIKUL_IDS) {
      expect(byId.get(id)?.id, `missing artikul ${id}`).toBe(id);
    }
  });

  it("publishes dump-proven 9095 sockets and hits, not on gear-spell 20546", () => {
    const glove = byId.get(9095);
    const tyrant = byId.get(20546);
    expect(glove?.title).toBe("Ветхая магическая перчатка");
    expect(glove?.extra.hits).toEqual([2, 3, 2, 3, 1, 2, 3, 1]);
    expect(Array.isArray(glove?.extra.spells)).toBe(true);
    expect(tyrant?.title).toBe("Изначальная мифическая перчатка тирана VI");
    expect(tyrant?.extra.spell?.groupId).toBe(936);
    expect(tyrant?.extra.spells).toBeUndefined();
    expect(tyrant?.extra.hits).toBeUndefined();
  });
});
