import { NO_STRIKE_MODS } from "../../../src/modules/combat/domain/strike-mods.ts";
import { unitStatBase } from "../../support/stat-base.ts";
import { describe, expect, it } from "vitest";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { snapshotFightEffects } from "../../../src/modules/combat/domain/snapshot-fight-effects.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { UNIT_HUNT_APPEARANCE, unitHuntHumanStats } from "../../support/hunt-start-input.ts";

describe("snapshotFightEffects", () => {
  it("returns human and bot standing snapshots with img", () => {
    const ids = new FightEffectIds();
    const human = new HumanFighter({
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
      strike: NO_STRIKE_MODS,
      sourceId: 1,
      artikulId: 99,
      title: "Малый усиливающий орб",
      img: "bottles_sila1.png",
      dmgType: 1,
      remainTurns: 1,
      groupId: 842,
    });
    const botEffects = new FighterEffects({
      heroId: 1_000_000,
      base: unitStatBase(15),
      startedAtMs: 0,
      gearSpells: [],
      effectIds: ids,
    });
    const emptyBot = { id: 1_000_000, effects: botEffects };
    expect(snapshotFightEffects([human], [emptyBot], 1, 0)).toEqual(human.effects.snapshot());
    expect(snapshotFightEffects([human], [emptyBot], 1_000_000, 0)).toEqual([]);
    botEffects.attachChargingKind3({
      strike: NO_STRIKE_MODS,
      sourceId: 1_000_000,
      artikulId: 397,
      title: "Смертельное прикосновение",
      img: "hissa_magic1.png",
      dmgType: 64,
      remainTurns: 1,
      groupId: 845,
    });
    expect(snapshotFightEffects([human], [emptyBot], 1_000_000, 0)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artikulId: 397, img: "hissa_magic1.png" }),
      ]),
    );
    expect(() => snapshotFightEffects([human], [emptyBot], 3, 0)).toThrow(
      /Fight participant 3 is missing/,
    );
  });
});
