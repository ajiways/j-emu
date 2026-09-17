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
      new FightEffectIds(),
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
        title: "Ядовитый плевок",
        picture: "hissa_magic1.png",
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

  it("attaches Hissa 396 kind-4 as effUse before the kind-1 hit", () => {
    const actor = HuntRosterBot.fromSeed(
      {
        fightId: 1_000_000,
        artikulId: 4,
        nick: "Хисса",
        level: 2,
        hp: 30,
        strength: 15,
        initiative: 0,
        magPower: 0,
        magResist: 0,
        avatar: "avatar_hissa1_sm.jpg",
        sk: "16",
        body: "",
        spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      },
      2,
      new FightEffectIds(),
    );
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
        title: "Ядовитый плевок",
        picture: "hissa_magic1.png",
        slot: "turn_roulette",
        weight: 10,
        maxCasts: null,
        gate: null,
        hpPct: null,
        spell: {
          animData: "magic_direct",
          groupId: 845,
          endTurn: true,
          effects: [
            { kind: 1, dmgType: 64, skills: [{ skillId: "pcSTR", value: -50 }] },
            { kind: 4, dmgType: 64, duration: 81 },
          ],
        },
      },
      {
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([1]),
        fightId: "8",
        keepFightOnKill: true,
        living: [human],
        winnerTeam: 2,
      },
    );
    expect(events).toMatchObject([
      {
        type: "effect-use",
        artikulId: 396,
        kind: 4,
        img: "hissa_magic1.png",
        title: "Ядовитый плевок",
        groupId: 845,
        persId: 1,
        remainTime: 120,
      },
      { type: "damage", animation: "magic_direct", hpChange: -1, killed: false },
    ]);
    expect(events.some((event) => event.type === "damage" && event.animation === "")).toBe(false);
    expect(human.effects.snapshot()).toHaveLength(1);
  });

  it("hangs Hissa 397 charging overlay as bot effUse before magic_baf", () => {
    const ids = new FightEffectIds();
    const actor = HuntRosterBot.fromSeed(
      {
        fightId: 1_000_000,
        artikulId: 4,
        nick: "Хисса",
        level: 2,
        hp: 30,
        strength: 15,
        initiative: 0,
        magPower: 0,
        magResist: 0,
        avatar: "avatar_hissa1_sm.jpg",
        sk: "16",
        body: "",
        spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      },
      2,
      ids,
    );
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
      ...unitHuntHumanStats(80),
      startedAtMs: 0,
      loadout: EMPTY_COMBAT_LOADOUT,
      appearance: UNIT_HUNT_APPEARANCE,
      effectIds: ids,
    });
    const events = actBotSpellCard(
      actor,
      human,
      {
        artikulId: 397,
        title: "Смертельное прикосновение",
        picture: "hissa_magic1.png",
        slot: "turn_roulette",
        weight: 8,
        maxCasts: null,
        gate: null,
        hpPct: null,
        spell: {
          animData: "magic_baf",
          groupId: 845,
          effects: [
            { kind: 1, dmgType: 64, charging: 1, skills: [{ skillId: "pcSTR", value: -84 }] },
          ],
        },
      },
      {
        rules: UNIT_BATTLE_RULES,
        random: new SequenceRandom([1]),
        fightId: "8",
        keepFightOnKill: true,
        living: [human],
        winnerTeam: 2,
      },
    );
    expect(events).toMatchObject([
      {
        type: "effect-use",
        artikulId: 397,
        kind: 3,
        img: "hissa_magic1.png",
        title: "Смертельное прикосновение",
        persId: 1_000_000,
        groupId: 845,
      },
      { type: "buff-cast", animation: "magic_baf", sourceId: 1_000_000, targetId: 1_000_000 },
    ]);
    expect(actor.effects.snapshot()).toMatchObject([{ artikulId: 397, kind: 3 }]);
    expect(actor.schoolOverlay?.charges).toBe(1);
  });
});
