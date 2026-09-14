import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

describe("generated economy corpus", () => {
  const playable = loadContentBundleFile(
    path.resolve(process.cwd(), "content/playable-slice.json"),
  );

  it("keeps wire IDs of e2e store, reputation, bonus, and USE rows", () => {
    expect(playable.storeTypes).toHaveLength(113);
    expect(playable.storeLots).toHaveLength(2095);
    expect(playable.reputationTracks).toHaveLength(22);
    expect(playable.bonuses).toHaveLength(5);
    expect(playable.useScripts).toHaveLength(7);
    expect(playable.storeTypes.some((row) => row.areaId === "504" && row.typeId === -131)).toBe(
      true,
    );
    expect(
      playable.storeLots.some(
        (lot) =>
          lot.areaId === "504" && lot.lotId === 80 && lot.artikulId === 23 && lot.typeId === -131,
      ),
    ).toBe(true);
    expect(
      playable.storeLots.some(
        (lot) =>
          lot.areaId === "504" && lot.lotId === 82 && lot.artikulId === 24 && lot.typeId === -131,
      ),
    ).toBe(true);
    expect(
      playable.storeLots.some(
        (lot) =>
          lot.areaId === "552" &&
          lot.lotId === 438 &&
          lot.artikulId === 621 &&
          lot.typeId === 11 &&
          lot.requires &&
          "all" in lot.requires &&
          lot.requires.all.some((pred) => pred.type === "RANK" && pred.min === 4),
      ),
    ).toBe(true);
    const radvey = playable.reputationTracks.find((track) => track.objectId === 5);
    expect(radvey).toMatchObject({
      type: 2,
      title: "Репутация Радвея",
      image: "rep_radvey_sm.png",
      unlockFlag: "",
    });
    expect(playable.reputationTracks.some((track) => track.objectId === 36)).toBe(false);
    expect(playable.bonuses.some((bonus) => bonus.id === 601 && bonus.artikulId === 623)).toBe(
      true,
    );
    const amulet = playable.useScripts.find((script) => script.bonusId === 2827);
    expect(amulet?.effects).toEqual(
      expect.arrayContaining([
        { type: "consume", artikulId: 2371, count: 2 },
        { type: "grant", artikulId: 55, count: 1 },
      ]),
    );
    expect(playable.useScripts.some((script) => script.bonusId === 584)).toBe(false);
    expect(playable.useScripts.some((script) => script.bonusId === 900584)).toBe(false);
  });
});
