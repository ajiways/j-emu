import { describe, expect, it } from "vitest";
import type { CombatLoadout } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";

const LOADOUT: CombatLoadout = {
  pocket: [
    {
      itemId: 100_001,
      artifactId: 169,
      position: 1,
      count: 1,
      title: "Малый эликсир богатыря",
      picture: "bottles_live1_2712.png",
      spell: {
        animData: "botles_giant_grey",
        groupId: 843,
        persRestr: { dead: false },
        targetRestr: { dead: false, self: true },
        effects: [
          { kind: 3, order: -1, skills: [{ skillId: "pcHPMAX", value: 35 }] },
          { kind: 2, amount: "26%", order: 1 },
        ],
      },
    },
  ],
  idols: [],
  glove: {
    hits: [2, 2, 2, 2, 2, 2, 2, 2],
    spells: [
      {
        artikulId: 182,
        cost: 1,
        row: 1,
        title: "Покров Тьмы I",
        picture: "dark_buff1.png",
        spell: {
          animData: "magic_baf_dark",
          groupId: 852,
          persRestr: { dead: false },
          targetRestr: { self: true, dead: false },
          effects: [
            {
              kind: 3,
              order: -1,
              duration: 400,
              skills: [
                { skillId: "DEX", value: 19 },
                { skillId: "pcDEX", value: 23 },
              ],
            },
          ],
        },
      },
    ],
  },
  gearSpells: [],
};

async function startedFight() {
  const created = createCombatService({ random: new FixedRandom() });
  await startHuntWithIssuedId(
    created.combat,
    unitHuntStart({
      loadout: LOADOUT,
      heroHp: 93,
      heroMaxHp: 111,
      heroDexterity: 36,
      botHp: 500,
    }),
  );
  await created.combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
  await created.combat.execute(1, { kind: "poll" });
  return created;
}

describe("timed buffs through a fight", () => {
  it("drinks the hero elixir: max hp up, hp healed, the new totals shown", async () => {
    const { combat } = await startedFight();
    await combat.execute(1, { kind: "pocket", itemId: 100_001, sequence: 2 });
    expect(combat.takePocketConsume(1)).toBe(100_001);
    const events = await combat.execute(1, { kind: "poll" });
    expect(events.map((event) => event.type)).toEqual([
      "command-accepted",
      "effect-use",
      "damage",
      "pers-change",
    ]);
    const change = events.find((event) => event.type === "pers-change");
    expect(change).toMatchObject({ humans: [expect.objectContaining({ hp: 132, maxHp: 150 })] });
  });

  it("casts Покров Тьмы from the glove: a standing effect with the baked skills", async () => {
    const { combat } = await startedFight();
    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "glove", spellId: 182, sequence: 3 });
    const events = await combat.execute(1, { kind: "poll" });
    expect(events.map((event) => event.type)).toEqual([
      "command-accepted",
      "effect-use",
      "pers-cp",
    ]);
    expect(events.find((event) => event.type === "effect-use")).toMatchObject({
      artikulId: 182,
      groupId: 852,
      remainTime: 400,
      skills: { DEX: 32, pcDEX: 1.23 },
    });
  });
});
