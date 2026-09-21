import { describe, expect, it } from "vitest";
import { Battle } from "../../../src/modules/combat/domain/battle.ts";
import { FightRules } from "../../../src/modules/combat/domain/fight-rules.ts";
import type { HuntRosterBotSeed } from "../../../src/modules/combat/domain/hunt-roster-bot.ts";
import { requireFightSetup } from "../../../src/modules/combat/domain/require-fight-setup.ts";
import { wireFightTypeOf } from "../../../src/modules/combat/domain/fight-result-info.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitDuelFightSetup, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const random = () => new SequenceRandom([8]);

function extraEnemy(fightId: number): HuntRosterBotSeed {
  return {
    fightId,
    artikulId: 32,
    nick: "Spirit",
    level: 1,
    hp: 20,
    strength: 10,
    initiative: 0,
    magPower: 0,
    magResist: 0,
    avatar: GRYZL_FIGHT_LOOK.botAvatar,
    sk: GRYZL_FIGHT_LOOK.botSk,
    body: GRYZL_FIGHT_LOOK.botBody,
    spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
  };
}

describe("FightSetup", () => {
  it("exposes quest as purpose while Battle.kind and wire type stay hunt", () => {
    const battle = createUnitBattle(unitHuntFightSetup({ purpose: "quest" }), random());
    expect(battle.purpose).toBe("quest");
    expect(battle.kind).toBe("hunt");
    expect(wireFightTypeOf(battle.kind)).toBe("1");
    expect(battle.questChat()).toEqual({ chatWin: "", chatLose: "" });
  });

  it("keeps friendly-duel purpose and wire type 6", () => {
    const battle = createUnitBattle(unitDuelFightSetup(), random());
    expect(battle.purpose).toBe("friendly-duel");
    expect(battle.kind).toBe("friendly-duel");
    expect(wireFightTypeOf(battle.kind)).toBe("6");
  });

  it("fails fast on an unknown meta.kind", () => {
    const setup = unitHuntFightSetup();
    expect(() =>
      requireFightSetup(
        { ...setup, meta: { ...setup.meta, kind: "arena" as never } },
        UNIT_BATTLE_RULES,
        FightRules.forHunt(null),
      ),
    ).toThrow(/Unknown fight kind: arena/);
  });

  it("fails fast when a required meta field is missing", () => {
    expect(() => createUnitBattle(unitHuntFightSetup({ areaId: "" }), random())).toThrow(
      /Battle area is required/,
    );
    expect(() => createUnitBattle(unitHuntFightSetup({ accessKey: "" }), random())).toThrow(
      /Fight access key is required/,
    );
  });

  it("fails fast when a human appearance field is missing", () => {
    const setup = unitHuntFightSetup({ appearance: { avatar: "", body: "m1", sk: "11" } });
    expect(() => createUnitBattle(setup, random())).toThrow(/Battle hero avatar is required/);
  });

  it("fails fast on a bot id that collides with a human or another bot", () => {
    expect(() => createUnitBattle(unitHuntFightSetup({ heroId: 1_000_000 }), random())).toThrow(
      /collides with the human participant id/,
    );
    expect(() =>
      createUnitBattle(unitHuntFightSetup({ extraEnemies: [extraEnemy(1_000_000)] }), random()),
    ).toThrow(/Roster bot fight id 1000000 collides/);
  });

  it("fails fast on a hunt setup that smuggles a quest roster", () => {
    expect(() =>
      createUnitBattle(unitHuntFightSetup({ extraEnemies: [extraEnemy(1_000_001)] }), random()),
    ).toThrow(/Hunt fights cannot include a quest roster/);
  });

  it("fails fast on PvP without a copy or flags and on a friendly duel that carries them", () => {
    expect(
      () =>
        new Battle(
          unitDuelFightSetup({ kind: "pvp", instanceCopyId: null, fightFlags: "8" }),
          UNIT_BATTLE_RULES,
          FightRules.forPvp(),
          random(),
        ),
    ).toThrow(/PvP fight copy is required/);
    expect(() => createUnitBattle(unitDuelFightSetup({ fightFlags: "8" }), random())).toThrow(
      /Friendly duel must not carry PvP flags/,
    );
  });
});
