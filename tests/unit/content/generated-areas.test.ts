import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

const E2E_AREA_IDS = [
  "503",
  "501",
  "504",
  "542",
  "544",
  "495",
  "552",
  "500",
  "635",
  "636",
  "637",
] as const;
const E2E_HUNT_IDS = [50310, 50309, 50101, 50102, 50103] as const;

describe("generated area corpus", () => {
  const playable = loadContentBundleFile(
    path.resolve(process.cwd(), "content/playable-slice.json"),
  );
  const areaIds = new Set(playable.areas.map((area) => area.id));
  const huntIds = new Set(playable.huntSpawns.map((spawn) => spawn.id));

  it("keeps wire IDs of e2e areas and hunts", () => {
    expect(playable.areas).toHaveLength(74);
    expect(playable.huntSpawns).toHaveLength(10);
    for (const id of E2E_AREA_IDS) expect(areaIds.has(id), `missing area ${id}`).toBe(true);
    for (const id of E2E_HUNT_IDS) expect(huntIds.has(id), `missing hunt ${id}`).toBe(true);
    expect(playable.areas.find((area) => area.id === "503")).toMatchObject({
      title: "Горное поселение",
      context: "4",
      hideRunningFights: 1,
      parentId: "",
    });
    expect(
      playable.areaLinks.some((link) => link.fromAreaId === "503" && link.toAreaId === "504"),
    ).toBe(true);
  });
});
