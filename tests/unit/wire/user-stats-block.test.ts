import { describe, expect, it } from "vitest";
import type { ReputationCatalog } from "../../../src/modules/catalog/ports/reputation-catalog.ts";
import type { ReputationTrack } from "../../../src/modules/catalog/domain/reputation-track.ts";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";
import { buildUserStatsBlock } from "../../../src/modules/jugger-wire/application/user-stats-block.ts";

const RADVEY: ReputationTrack = {
  objectId: 5,
  type: 2,
  title: "Репутация Радвея",
  image: "rep_radvey_sm.png",
  unlockFlag: "",
};

describe("buildUserStatsBlock", () => {
  it("omits zero type:2 rows and always includes SUM 36", async () => {
    const block = await buildUserStatsBlock({ exp: 1, honor: 0 }, [], fakeCatalog([RADVEY]), []);
    expect(block.status).toBe(100);
    expect(block.farm_stats).toEqual([]);
    expect(block.fish_stats).toEqual([]);
    expect(block.stats.map((row) => row.object_id)).toEqual(["1", "2", "3", "4", "8", "36", "49"]);
    expect(block.stats.some((row) => row.type === 2)).toBe(false);
    expect(stat(block.stats, "36")).toMatchObject({
      title: "Суммарная репутация",
      type: 3,
      value: 0,
      image: "",
    });
  });

  it("inserts a positive type:2 row before SUM", async () => {
    const block = await buildUserStatsBlock(
      { exp: 1, honor: 0 },
      [{ objectId: 5, value: 10 }],
      fakeCatalog([RADVEY]),
      [],
    );
    expect(block.stats.map((row) => row.object_id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "8",
      "5",
      "36",
      "49",
    ]);
    expect(stat(block.stats, "5")).toMatchObject({
      title: "Репутация Радвея",
      type: 2,
      value: 10,
      image: "rep_radvey_sm.png",
      type_id: "13",
    });
    expect(stat(block.stats, "36").value).toBe(10);
  });

  it("returns 204 when a positive row has no published track", async () => {
    await expect(
      buildUserStatsBlock({ exp: 1, honor: 0 }, [{ objectId: 5, value: 10 }], fakeCatalog([]), []),
    ).rejects.toBeInstanceOf(ProtocolError);
  });
});

function fakeCatalog(tracks: readonly ReputationTrack[]): ReputationCatalog {
  return {
    reputationTrack: async (objectId) =>
      tracks.find((track) => track.objectId === objectId) ?? null,
    reputationTracks: async () => tracks,
  };
}

function stat(
  rows: readonly { object_id: string; title: string; type: number; value: number; image: string }[],
  objectId: string,
) {
  const row = rows.find((entry) => entry.object_id === objectId);
  if (!row) throw new Error(`stat ${objectId} is missing`);
  return row;
}
