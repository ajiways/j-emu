import { describe, expect, it } from "vitest";
import {
  drinkDisplaceIds,
  drinkExpireAt,
  drinkTypeStackCap,
  KIND_INJURY,
} from "../../../src/modules/inventory/domain/drink-displace.ts";
import { ARTIFACT_KIND_SET_BONUS } from "../../../src/modules/catalog/domain/artifact-kind.ts";

describe("drinkDisplaceIds", () => {
  it("refreshes the same artikul and keeps a set bonus of the same type", () => {
    const drop = drinkDisplaceIds(
      [
        { id: 100_001, artifactId: 640, typeId: "10", kindId: 48 },
        { id: 100_002, artifactId: 106, typeId: "10", kindId: ARTIFACT_KIND_SET_BONUS },
        { id: 100_003, artifactId: 77, typeId: "10", kindId: KIND_INJURY },
      ],
      { id: 100_010, artifactId: 640, typeId: "10" },
    );
    expect(drop).toEqual([100_001]);
  });

  it("drops the oldest other buff when the type cap is 1", () => {
    expect(drinkTypeStackCap("10")).toBe(1);
    const drop = drinkDisplaceIds([{ id: 100_001, artifactId: 640, typeId: "10", kindId: 48 }], {
      id: 100_010,
      artifactId: 641,
      typeId: "10",
    });
    expect(drop).toEqual([100_001]);
  });
});

describe("drinkExpireAt", () => {
  it("adds duration seconds onto nowSec", () => {
    expect(drinkExpireAt(0, 1800, 1_700_000_000)).toBe(1_700_001_800);
  });

  it("uses expire 1 for one-fight flags", () => {
    expect(drinkExpireAt(256, 1800, 1_700_000_000)).toBe(1);
  });
});
