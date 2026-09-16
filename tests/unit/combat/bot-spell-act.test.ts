import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { actBotSpellCard } from "../../../src/modules/combat/domain/bot-spell-act.ts";
import { HuntHuman } from "../../../src/modules/combat/domain/hunt-human.ts";
import { HuntRosterBot } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
} from "../../support/hunt-start-input.ts";

describe("actBotSpellCard overkill", () => {
  it("sends hpChange equal to remaining HP on a kind-1 kill", () => {
    const actor = HuntRosterBot.fromSeed(
      {
        fightId: 1_000_000,
        artikulId: 4,
        nick: "Хисса",
        level: 2,
        hp: 30,
        strength: 80,
        initiative: 0,
        magPower: 0,
        magResist: 0,
        avatar: "avatar_hissa1_sm.jpg",
        sk: "16",
        body: "",
        spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      },
      2,
    );
    const human = new HuntHuman({
      accountId: 1,
      heroId: 1,
      nick: "H1",
      level: 1,
      kind: 1,
      hp: 3,
      maxHp: 27,
      mp: 10,
      maxMp: 10,
      team: 1,
      waiting: false,
      ...unitHuntHumanStats(80),
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: new FightEffectIds(),
    });
    const events = actBotSpellCard(
      actor,
      human,
      {
        artikulId: 396,
        slot: "turn_roulette",
        weight: 10,
        maxCasts: null,
        gate: null,
        hpPct: null,
        spell: { animData: "magic_direct", endTurn: true, effects: [{ kind: 1 }] },
      },
      {
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([8]),
        fightId: "8",
        keepFightOnKill: true,
        living: [human],
        winnerTeam: 2,
      },
    );
    expect(events).toMatchObject([
      { type: "damage", hpChange: -3, killed: true, animation: "magic_direct" },
    ]);
    expect(human.hp).toBe(0);
  });
});
