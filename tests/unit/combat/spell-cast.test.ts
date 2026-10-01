import { describe, expect, it } from "vitest";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatGloveSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

import { castTimedSpell } from "../../../src/modules/combat/domain/timed-spell.ts";
import { tryGloveKeepTurn } from "../../../src/modules/combat/domain/player-casts.ts";

const CRUSH: CombatGloveSpell = {
  artikulId: 6197,
  cost: 1,
  row: 1,
  title: "Сокрушение",
  picture: "magic_stun_hammer.png",
  spell: {
    animData: "magic_baf_stun",
    groupId: 895,
    effects: [
      { kind: 3, dmgType: 0, duration: 80, skills: [{ skillId: "DFR", value: 0.4 }] },
      { kind: 18, dmgType: 0, duration: 2, durationInTurns: true },
    ],
  },
};

/** A glove dispel of the stun group: a spell kind a bot could always cast and a player now can too. */
const CLEANSE: CombatGloveSpell = {
  artikulId: 7001,
  cost: 1,
  row: 1,
  title: "Очищение",
  picture: "magic_dispel.png",
  spell: {
    animData: "magic_dispel",
    cooldown: 30,
    effects: [{ kind: 8, targetEffectGroupId: 895 }],
  },
};

/** «Дар неистовства»: aimed at allies only, a player's one (not the caster, not a mob). */
const RALLY: CombatGloveSpell = {
  artikulId: 7002,
  cost: 1,
  row: 1,
  title: "Дар",
  picture: "p.png",
  spell: {
    animData: "magic_baf_electro",
    targetRestr: { self: false, opp: false, oppTeam: false, dead: false, noBot: true },
    effects: [{ kind: 3, duration: 40, skills: [{ skillId: "CRBonus", value: 27 }] }],
  },
};

function hero(id = 1): HumanFighter {
  const human = new HumanFighter({
    accountId: id,
    heroId: id,
    nick: `H${id}`,
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
      glove: { hits: [2, 2, 2, 2, 2, 2, 2, 2], spells: [CRUSH, CLEANSE, RALLY] },
    },
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  human.casts.cp = 5;
  return human;
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

describe("a player's glove spell goes through the same cast as a bot's", () => {
  it("dispels the foe's effect group with a glove dispel and puts the glove on cooldown", () => {
    const human = hero();
    const foe = bot();
    const cast = (spellId: number, nowMs: number) =>
      tryGloveKeepTurn(human, spellId, 1, false, { nowMs, foe: () => foe, ally: () => null });
    cast(6197, 0);
    expect(foe.effects.takenDamage(10, 1)).toBe(6);
    const cleansed = cast(7001, 1000);
    expect(cleansed).toMatchObject({ kind: "resolved" });
    const events = cleansed.kind === "resolved" ? cleansed.events : [];
    expect(events.map((event) => event.type)).toEqual(["effect-purge", "effect-purge", "pers-cp"]);
    expect(foe.effects.takenDamage(10, 1)).toBe(10);
    expect(() => cast(7001, 2000)).toThrow(/cooldown/);
  });

  it.each([1, 100])("does not stun a foe that stands under ANTI_STUN %i", (value) => {
    const human = hero();
    const foe = bot();
    castTimedSpell(
      foe,
      foe,
      {
        artikulId: 7188,
        title: "Защита от оглушения",
        picture: "p.png",
        flags: 0,
        spell: { effects: [{ kind: 3, duration: 80, skills: [{ skillId: "ANTI_STUN", value }] }] },
      },
      0,
    );
    tryGloveKeepTurn(human, 6197, 1, false, { nowMs: 0, foe: () => foe, ally: () => null });
    expect(foe.stunnedTurns).toBe(0);
    expect(foe.effects.takenDamage(10, 1)).toBe(6);
  });

  it("does not pile a stun on one that is still running", () => {
    const human = hero();
    const foe = bot();
    foe.stunnedTurns = 1;
    tryGloveKeepTurn(human, 6197, 1, false, { nowMs: 0, foe: () => foe, ally: () => null });
    expect(foe.stunnedTurns).toBe(1);
  });

  it("puts an ally-only buff on the ally it was cast on, not on the foe or the caster", () => {
    const human = hero();
    const mate = hero(2);
    const foe = bot();
    tryGloveKeepTurn(human, 7002, 1, false, { nowMs: 0, foe: () => foe, ally: () => mate });
    expect(foe.effects.standingSkill("CRBonus")).toBe(0);
    expect(human.effects.standingSkill("CRBonus")).toBe(0);
    expect(mate.effects.standingSkill("CRBonus")).toBe(27);
  });

  it("refuses an ally-only buff that has no ally to land on", () => {
    expect(() =>
      tryGloveKeepTurn(hero(), 7002, 1, false, { nowMs: 0, foe: () => bot(), ally: () => null }),
    ).toThrow(/needs an ally/);
  });
});
