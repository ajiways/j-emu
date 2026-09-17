import { describe, expect, it } from "vitest";
import type { CombatLoadout } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { battleRules, createCombatService } from "../../support/create-combat-service.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";

const orbLoadout: CombatLoadout = {
  pocket: [
    {
      itemId: 100_002,
      artifactId: 99,
      position: 2,
      count: 10,
      title: "Малый усиливающий орб",
      picture: "bottles_sila1.png",
      spell: {
        animData: "botles_strenght_grey",
        groupId: 842,
        flags: "262144",
        persRestr: { dead: false },
        targetRestr: { dead: false, groupdeny: true, self: true, selgroupdeny: [] },
        effects: [{ kind: 3, charging: 1, skills: [{ skillId: "pcSTR", value: 10 }] }],
      },
    },
  ],
  glove: null,
  gearSpells: [],
};

describe("CombatService roster effects", () => {
  it("fans out orb 99 to the other hunter and answers persEff/persInfo", async () => {
    const { combat } = createCombatService({
      random: new SequenceRandom([8, 2]),
      rules: battleRules(),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ loadout: orbLoadout, botHp: 50, heroStrength: 200 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const joinerBoot = await combat.execute(2, { kind: "poll" });
    const bootstrap = joinerBoot.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("Joiner hunt bootstrap is missing");
    }
    expect(bootstrap.otherEffects).toEqual([{ persId: 1, effects: [] }]);

    await combat.execute(1, { kind: "pocket", itemId: 100_002, sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    const ally = await combat.execute(2, { kind: "poll" });
    expect(ally).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "effect-use", artikulId: 99, persId: 1 }),
      ]),
    );

    expect(await combat.execute(2, { kind: "pers-info", sequence: 3 })).toEqual([
      { type: "command-accepted", sequence: 3 },
    ]);
    expect(await combat.execute(2, { kind: "pers-effects", persId: 1, sequence: 4 })).toEqual([]);
    const inspect = await combat.execute(2, { kind: "poll" });
    expect(inspect[0]).toEqual({ type: "command-accepted", sequence: 4 });
    expect(inspect[1]).toMatchObject({
      type: "pers-effects",
      persId: 1,
      effects: [expect.objectContaining({ artikulId: 99, kind: 3, img: "bottles_sila1.png" })],
    });

    await combat.execute(2, { kind: "pers-effects", persId: 1_000_000, sequence: 5 });
    const bot = await combat.execute(2, { kind: "poll" });
    expect(bot[1]).toEqual({ type: "pers-effects", persId: 1_000_000, effects: [] });

    await expect(
      combat.execute(2, { kind: "pers-effects", persId: 9, sequence: 6 }),
    ).rejects.toThrow(/Fight participant 9 is missing/);
  });
});
