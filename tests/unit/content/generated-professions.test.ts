import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

describe("generated profession corpus", () => {
  const playable = loadContentBundleFile(
    path.resolve(process.cwd(), "content/playable-slice.json"),
  );

  it("keeps wire IDs of e2e assistants, farms, and recipe 61", () => {
    expect(playable.assistantTypes).toHaveLength(45);
    expect(playable.farmResources).toHaveLength(83);
    expect(playable.areaFarms).toHaveLength(86);
    expect(playable.craftRecipes).toHaveLength(266);
    expect(playable.assistantTypes.some((row) => row.id === 28)).toBe(false);
    const starter = playable.assistantTypes.find((row) => row.id === 3);
    expect(starter).toMatchObject({
      title: "Имуро-Юи",
      profession: 2,
      nextArtikulId: 13,
      picture: "gremlin_star_grey_1.png",
    });
    const next = playable.assistantTypes.find((row) => row.id === 13);
    expect(next?.restrictionsXml).toContain('id="1720"');
    const crystal = playable.farmResources.find((row) => row.id === 4);
    expect(crystal).toMatchObject({
      title: "Хрусталь",
      artifactArtikulId: 1720,
      farmTime: 60,
      staminaDrain: 4,
    });
    expect(
      playable.areaFarms.some(
        (spot) =>
          spot.areaId === "500" &&
          spot.huntSpotId === 15 &&
          spot.farmId === 4 &&
          spot.cntCurrent === 1396,
      ),
    ).toBe(true);
    const recipe = playable.craftRecipes.find((row) => row.id === 61);
    expect(recipe).toMatchObject({
      artikulId: 1861,
      professionId: 6,
      duration: 35,
      createArtikulId: 1714,
      createArtikulNum: 10,
    });
    expect(recipe?.ingredients).toEqual([{ artikulId: 1720, amount: 1 }]);
    expect(playable.craftRecipes.some((row) => row.professionId === 0)).toBe(false);
    expect(playable.craftRecipes.some((row) => row.type !== 1)).toBe(false);
  });
});
