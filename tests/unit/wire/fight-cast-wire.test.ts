import { describe, expect, it } from "vitest";
import { fightCastEvent } from "../../../src/modules/jugger-wire/application/fight-cast-wire.ts";

const STRIKE = {
  type: "damage" as const,
  sourceId: 1,
  targetId: 1_000_000,
  animation: "attack_center",
  hpChange: 0,
  targetMaxHp: 50,
  killed: false,
  react: 2,
};

describe("fightCastEvent", () => {
  it("tells the client how much a block took, on the cast and on its hit", () => {
    const cast = fightCastEvent({ ...STRIKE, blocked: 7 });
    expect(cast).toMatchObject({ react: 2, blocked: 7 });
    expect(cast["ev"]).toMatchObject({ "1": { et: "hpChange", hp: 0, blocked: 7 } });
  });

  it("says nothing of a block on a plain hit", () => {
    const cast = fightCastEvent({ ...STRIKE, hpChange: -5 });
    expect(cast).not.toHaveProperty("blocked");
    expect(JSON.stringify(cast["ev"])).not.toContain("blocked");
  });
});
