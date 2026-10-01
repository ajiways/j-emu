import { describe, expect, it } from "vitest";
import { tryAggro } from "../../../src/modules/combat/domain/aggro.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { HumanFighter } from "../../../src/modules/combat/domain/human-fighter.ts";
import { huntNativePersSpells } from "../../../src/modules/jugger-wire/application/hunt-native-pers-spells.ts";
import {
  UNIT_HUNT_APPEARANCE,
  unitHuntHumanStats,
  unitRosterBot,
} from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { rosterOf } from "../../support/roster-of.ts";

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
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: UNIT_HUNT_APPEARANCE,
    effectIds: new FightEffectIds(),
  });
  human.authed = true;
  return human;
}

function aggroAt(bot: ReturnType<typeof unitRosterBot>) {
  const human = hero();
  const roster = rosterOf([human], [bot]);
  const result = tryAggro({
    canAggro: true,
    finished: false,
    roster,
    duels: [],
    addBot: (clone) => roster.add(clone),
    enemyTeam: 2,
    random: new SequenceRandom([1]),
    accountId: 1,
    targetId: bot.fightId,
    allocateBotId: () => 1_000_009,
  });
  return { result, roster, human };
}

describe("aggro limits", () => {
  it("clones an ordinary enemy mob", () => {
    const { roster, human } = aggroAt(unitRosterBot());
    expect(roster.bots).toHaveLength(2);
    expect(human.casts.aggro).toBe(0);
  });

  it("never clones a summoned mob", () => {
    const phantom = unitRosterBot();
    phantom.summoned = true;
    const { roster, human } = aggroAt(phantom);
    expect(roster.bots).toHaveLength(1);
    expect(human.casts.aggro).toBeGreaterThan(0);
  });

  it("lists no aggro button where the fight has none", () => {
    const titles = (event: Readonly<Record<string, unknown>>) =>
      Object.values(event).flatMap((value) =>
        typeof value === "object" && value !== null && "title" in value
          ? [String(value.title)]
          : [],
      );
    expect(titles(huntNativePersSpells(1))).toContain("Разозлить");
    expect(titles(huntNativePersSpells(null))).not.toContain("Разозлить");
  });
});
