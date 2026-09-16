import { describe, expect, it } from "vitest";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { snapshotFightEffects } from "../../../src/modules/combat/domain/snapshot-fight-effects.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

describe("snapshotFightEffects", () => {
  it("returns a human standing snapshot and an empty bot snapshot", () => {
    const ids = new FightEffectIds();
    const human = new HuntHuman({
      accountId: 1,
      heroId: 1,
      nick: "H1",
      level: 1,
      kind: 1,
      hp: 27,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      team: 1,
      waiting: false,
      ...unitHuntHumanStats(),
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: ids,
    });
    human.effects.attachChargingKind3({
      sourceId: 1,
      artikulId: 99,
      title: "Малый усиливающий орб",
      img: "bottles_sila1.png",
      dmgType: 1,
      remainTurns: 1,
      groupId: 842,
    });
    expect(snapshotFightEffects([human], [{ id: 1_000_000 }], 1)).toEqual(human.effects.snapshot());
    expect(snapshotFightEffects([human], [{ id: 1_000_000 }], 1_000_000)).toEqual([]);
    expect(() => snapshotFightEffects([human], [{ id: 1_000_000 }], 3)).toThrow(
      /Fight participant 3 is missing/,
    );
  });
});
