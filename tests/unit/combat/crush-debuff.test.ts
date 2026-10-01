import { describe, expect, it } from "vitest";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatGloveSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { tryGloveKeepTurn } from "../../../src/modules/combat/domain/player-casts.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

/** Сокрушение 6197: two turns of stun and, for 80 s, the target takes 60% of any damage. */
const CRUSH: CombatGloveSpell = {
  artikulId: 6197,
  cost: 1,
  row: 1,
  title: "Сокрушение",
  picture: "magic_stun_hammer.png",
  spell: {
    animData: "magic_baf_stun",
    groupId: 895,
    cooldown: 300,
    effects: [
      {
        kind: 3,
        dmgType: 0,
        order: -1,
        dmgMask: 509,
        duration: 80,
        skills: [
          { skillId: "DFR", value: 0.4 },
          { skillId: "MAG_DFR", value: 0.4 },
        ],
      },
      { kind: 18, dmgType: 0, order: -1, duration: 2, durationInTurns: true },
    ],
  },
};

function hero(): HumanFighter {
  const human = new HumanFighter({
    accountId: 1,
    heroId: 1,
    nick: "H1",
    level: 7,
    kind: 1,
    hp: 50,
    maxHp: 50,
    mp: 10,
    maxMp: 10,
    team: 1,
    waiting: false,
    ...unitHuntHumanStats(20),
    startedAtMs: 0,
    loadout: {
      ...EMPTY_COMBAT_LOADOUT,
      glove: { hits: [2, 2, 2, 2, 2, 2, 2, 2], spells: [CRUSH] },
    },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  human.casts.cp = 1;
  return human;
}

/** The glove keep-turn cast of Сокрушение by a hero whose foe is `foe`. */
function castCrush(foe: BotFighter) {
  const result = tryGloveKeepTurn(hero(), CRUSH.artikulId, 1, false, {
    nowMs: 0,
    foe: () => foe,
    allies: () => [],
  });
  if (result.kind !== "resolved") throw new Error("Сокрушение was not cast");
  return result.events;
}

function bot(): BotFighter {
  return BotFighter.fromSeed(
    {
      fightId: 1_000_000,
      artikulId: 6,
      nick: "Разбойник",
      level: 7,
      hp: 100,
      strength: 10,
      initiative: 0,
      magPower: 0,
      magResist: 0,
      avatar: "a.jpg",
      sk: "1",
      body: "",
      spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    },
    2,
    new FightEffectIds(),
  );
}

describe("Сокрушение", () => {
  it("stuns the foe and leaves it taking 60% of physical and magic damage, but not death signs", () => {
    const foe = bot();
    const events = castCrush(foe);
    expect(events.filter((event) => event.type === "effect-use").map((e) => e.kind)).toEqual([
      3, 18,
    ]);
    expect(foe.stunnedTurns).toBe(2);
    expect(foe.effects.takenDamage(10, 1)).toBe(6);
    expect(foe.effects.takenDamage(10, 64)).toBe(6);
    expect(foe.effects.takenDamage(10, 256)).toBe(10);
    expect(foe.effects.takenDamage(10, 2)).toBe(10);
  });

  it("lets the debuff run out on the fight clock after 80 seconds", () => {
    const foe = bot();
    castCrush(foe);
    for (let action = 1; action <= 3; action += 1) foe.effects.advanceOnAction(0, 20);
    expect(foe.effects.takenDamage(10, 1)).toBe(6);
    foe.effects.advanceOnAction(0, 20);
    expect(foe.effects.takenDamage(10, 1)).toBe(10);
  });
});
