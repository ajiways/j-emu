import { describe, expect, it } from "vitest";
import {
  appropriateTactics,
  farmAttackAt,
  farmCycle,
  farmDurationSec,
  masteryAllowsFarm,
  slotGoldCost,
} from "../../../src/modules/professions/domain/farm-formulas.ts";
import { parseRequirementXml } from "../../../src/modules/professions/domain/parse-requirement-xml.ts";

describe("farm formulas", () => {
  it("matches climate 0 with gremlin tactics 1 and always succeeds", () => {
    expect(appropriateTactics(0)).toBe(1);
    expect(farmCycle({ tacticMatch: true }, { unit: () => 0 })).toBe("success");
  });

  it("does not schedule an attack when rng.unit is 0.999", () => {
    expect(farmAttackAt(100, 160, 0, { unit: () => 0.999 })).toBe(0);
  });

  it("keeps dump farm duration and first-slot gold", () => {
    expect(farmDurationSec(60, 0)).toBe(60);
    expect(slotGoldCost(0)).toBe(10);
    expect(masteryAllowsFarm(1, 0)).toBe(true);
  });
});

describe("parseRequirementXml", () => {
  it("reads dump upgrade artifacts", () => {
    expect(
      parseRequirementXml(
        '<requirement type="artifact" id="1720" value="180"/><requirement type="artifact" id="1721" value="170"/><requirement type="artifact" id="1722" value="170"/>',
      ),
    ).toEqual([
      { type: "artifact", id: 1720, value: 180 },
      { type: "artifact", id: 1721, value: 170 },
      { type: "artifact", id: 1722, value: 170 },
    ]);
  });
});
