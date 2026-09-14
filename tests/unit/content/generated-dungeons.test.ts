import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

describe("generated dungeon corpus", () => {
  const playable = loadContentBundleFile(
    path.resolve(process.cwd(), "content/playable-slice.json"),
  );

  it("keeps wire IDs of e2e dungeons and publishes 4/6/7", () => {
    expect(playable.dungeons).toHaveLength(8);
    const ogre = playable.dungeons.find((row) => row.artikulId === 1);
    expect(ogre).toMatchObject({
      title: "Мрачная пещера",
      startAreaId: "542",
      parentAreaId: "501",
      hasClear: false,
      loot: { bossBotId: 99, personalGuaranteed: [2371] },
    });
    expect(ogre?.areas[0]?.spawns[0]?.spawnKey).toBe("ogre");
    const pit = playable.dungeons.find((row) => row.artikulId === 2);
    expect(pit).toMatchObject({
      startAreaId: "544",
      hasClear: true,
      progressFinishValue: 7,
      clear: { coinArtikulId: 5986, coinMin: 1, coinMax: 26 },
    });
    expect(playable.dungeons.map((row) => row.artikulId)).toEqual([1, 2, 4, 6, 7, 11, 12, 14]);
    const proval = playable.dungeons.find((row) => row.artikulId === 4);
    expect(proval).toMatchObject({
      startAreaId: "548",
      hasClear: true,
      progressFinishValue: 9,
      clear: { coinArtikulId: 3163, coinMin: 1, coinMax: 30 },
    });
    const nory = playable.dungeons.find((row) => row.artikulId === 6);
    expect(nory).toMatchObject({
      startAreaId: "586",
      hasClear: true,
      progressFinishValue: 7,
      clear: { coinArtikulId: 5985, coinMin: 2, coinMax: 33 },
    });
    const hardif = playable.dungeons.find((row) => row.artikulId === 7);
    expect(hardif).toMatchObject({
      startAreaId: "617",
      hasClear: true,
      progressFinishValue: 12,
      clear: { coinArtikulId: 3679, coinMin: 1, coinMax: 33 },
    });
  });
});
