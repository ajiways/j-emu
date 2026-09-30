import { describe, expect, it } from "vitest";
import { actBotSpellCard } from "../../../src/modules/combat/domain/bot-spell-act.ts";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

const STATE = {
  rules: UNIT_BATTLE_RULES,
  random: new FixedRandom(),
  fightId: "8",
  keepFightOnKill: true,
  living: [],
  winnerTeam: 2 as const,
  nowMs: 0,
  enemies: [],
};

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
      avatar: "avatar_razboynik_sm.jpg",
      sk: "1",
      body: "",
      spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    },
    2,
    new FightEffectIds(),
  );
}

function human(): HumanFighter {
  return new HumanFighter({
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
    dexterity: 40,
    startedAtMs: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
}

const card = (artikulId: number, spell: CombatSpell) => ({
  artikulId,
  title: "spell",
  picture: "p.png",
  slot: "prefer" as const,
  weight: 0,
  maxCasts: null,
  gate: null,
  hpPct: null,
  spell,
});

describe("bot timed spells", () => {
  it("puts a self buff on the bot: stats and max hp follow the same layer as the hero's", () => {
    const actor = bot();
    const events = actBotSpellCard(
      actor,
      human(),
      card(183, {
        animData: "magic_baf",
        groupId: 851,
        targetRestr: { self: true },
        effects: [
          {
            kind: 3,
            duration: 400,
            forceSelfTargeting: true,
            skills: [
              { skillId: "DEX", value: 20 },
              { skillId: "HPMAX", value: 25 },
            ],
          },
        ],
      }),
      STATE,
    ).events;
    expect(events.map((event) => event.type)).toEqual(["effect-use", "buff-cast"]);
    expect(events[0]).toMatchObject({ persId: 1_000_000, skills: { DEX: 20, HPMAX: 25 } });
    expect(actor.dexterity).toBe(20);
    expect(actor.maxHp).toBe(125);
  });

  it("puts a debuff on the hero when the spell is not cast on oneself", () => {
    const foe = human();
    const events = actBotSpellCard(
      bot(),
      foe,
      card(188, {
        animData: "magic_baf",
        groupId: 853,
        targetRestr: { opp: true },
        effects: [{ kind: 3, duration: 400, skills: [{ skillId: "pcDEX", value: -50 }] }],
      }),
      STATE,
    ).events;
    expect(events[0]).toMatchObject({ type: "effect-use", persId: 1, sourceId: 1_000_000 });
    expect(foe.dexterity).toBe(20);
  });
});
