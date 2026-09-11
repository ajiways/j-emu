import { describe, expect, it } from "vitest";
import { FightCastDenied } from "../../../src/modules/combat/domain/fight-cast-denied.ts";
import type { CombatLoadout } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { battleRules, createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";

const elixirSpell = {
  animData: "botles_healself_grey",
  cooldown: 20,
  groupId: 841,
  flags: "262144",
  persRestr: { dead: false },
  targetRestr: { dead: false, self: true, selgroupdeny: { cond: true, id: 956 } },
  effects: [{ kind: 2, amount: 15 }],
} as const;

const orbSpell = {
  animData: "botles_strenght_grey",
  groupId: 842,
  flags: "262144",
  persRestr: { dead: false },
  targetRestr: { dead: false, groupdeny: true, self: true, selgroupdeny: [] },
  effects: [{ kind: 3, charging: 1, skills: [{ skillId: "pcSTR", value: 10 }] }],
} as const;

function dumpLoadout(overrides: Partial<CombatLoadout> = {}): CombatLoadout {
  return {
    pocket: [
      {
        itemId: 100_001,
        artifactId: 93,
        position: 1,
        count: 1,
        title: "Малый эликсир жизни",
        picture: "bottles_live1_2712.png",
        spell: elixirSpell,
      },
      {
        itemId: 100_002,
        artifactId: 99,
        position: 2,
        count: 10,
        title: "Малый усиливающий орб",
        picture: "bottles_sila1.png",
        spell: orbSpell,
      },
    ],
    glove: {
      hits: [2, 3, 2, 3, 1, 2, 3, 1],
      spells: [
        {
          artikulId: 9098,
          cost: 2,
          row: 1,
          title: "Разряд молнии",
          picture: "electro_ball1.png",
          spell: {
            animData: "magic_electroball",
            endTurn: true,
            persRestr: { active: true, dead: false },
            targetRestr: { opp: true, dead: false, selgroupdeny: {} },
            effects: [{ kind: 1, dmgType: 128 }],
          },
        },
        {
          artikulId: 9100,
          cost: 3,
          row: 1,
          title: "Жажда крови",
          picture: "kaban_magic_mosch.png",
          spell: {
            persRestr: { active: true, dead: false },
            targetRestr: { self: true, dead: false },
            effects: [{ kind: 3, charging: 1 }],
          },
        },
        {
          artikulId: 9099,
          cost: 4,
          row: 1,
          title: "Волна света",
          picture: "ludoed_magic_light.png",
          spell: {
            animData: "magic_aoe_light",
            endTurn: true,
            persRestr: { active: true, dead: false },
            targetRestr: { opp: true, dead: false },
            effects: [{ kind: 1, targetCount: 2 }],
          },
        },
      ],
    },
    gearSpells: [],
    ...overrides,
  };
}

describe("CombatService pocket glove rage", () => {
  it("orders pocket 93 and 99 as rs then FX without persSpells", async () => {
    const { combat } = createCombatService({
      random: new SequenceRandom([8, 2]),
      rules: battleRules(),
    });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "pocket", itemId: 100_001, sequence: 2 });
    expect(combat.takePocketConsume(1)).toBe(100_001);
    expect((await combat.execute(1, { kind: "poll" })).map((event) => event.type)).toEqual([
      "command-accepted",
      "effect-use",
      "damage",
    ]);
    await combat.execute(1, { kind: "pocket", itemId: 100_002, sequence: 3 });
    const orb = await combat.execute(1, { kind: "poll" });
    expect(orb.map((event) => event.type)).toEqual(["command-accepted", "effect-use", "buff-cast"]);
    expect(orb.some((event) => event.type === "native-count")).toBe(false);
  });

  it("denies elixir 93 cooldown without poll events", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat } = createCombatService({ clock });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "pocket", itemId: 100_001, sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await expect(
      combat.execute(1, { kind: "pocket", itemId: 100_001, sequence: 3 }),
    ).rejects.toBeInstanceOf(FightCastDenied);
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
  });

  it("orders rage then fury and aggro then absolute count", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 2]),
    });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "rage", sequence: 3 });
    expect((await combat.execute(1, { kind: "poll" })).map((event) => event.type)).toEqual([
      "command-accepted",
      "effect-use",
      "buff-cast",
    ]);
    await combat.execute(1, { kind: "aggro", sequence: 4 });
    const aggro = await combat.execute(1, { kind: "poll" });
    expect(aggro.map((event) => event.type)).toEqual(["command-accepted", "native-count"]);
    expect(aggro[1]).toMatchObject({ type: "native-count", srcId: 7, count: 0 });
  });

  it("keeps unspent cp on off-turn ending glove", async () => {
    const { combat } = createCombatService({
      random: new SequenceRandom([8, 2]),
      rules: battleRules(),
    });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    const first = await combat.execute(1, { kind: "poll" });
    expect(first.find((event) => event.type === "damage")).toMatchObject({ comboCp: 1 });
    await combat.execute(1, { kind: "glove", spellId: 9098, sequence: 3 });
    expect(await combat.execute(1, { kind: "poll" })).toEqual([
      { type: "command-accepted", sequence: 3 },
      { type: "pers-cp", cp: 1 },
    ]);
  });

  it("casts 9100 keep-turn after three matching hits", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 2, 8, 2, 8, 2]),
    });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await strikeAndLoop(combat, delay, clock, "center", 2);
    await strikeAndLoop(combat, delay, clock, "right", 3);
    await strikeAndLoop(combat, delay, clock, "center", 4);
    await combat.execute(1, { kind: "glove", spellId: 9100, sequence: 5 });
    expect((await combat.execute(1, { kind: "poll" })).map((event) => event.type)).toEqual([
      "command-accepted",
      "effect-use",
      "buff-cast",
      "pers-cp",
    ]);
  });

  it("casts 9098 ending as rs then strike after combo", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 2, 8, 2, 8]),
    });
    await startHuntWithIssuedId(combat, unitHuntStart({ loadout: dumpLoadout(), botHp: 50 }));
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await strikeAndLoop(combat, delay, clock, "center", 2);
    await strikeAndLoop(combat, delay, clock, "right", 3);
    await combat.execute(1, { kind: "glove", spellId: 9098, sequence: 4 });
    expect((await combat.execute(1, { kind: "poll" })).map((event) => event.type)).toEqual([
      "command-accepted",
      "turn-wait",
      "damage",
    ]);
  });

  it("denies kind 11 on HTTP path shape without queueing", async () => {
    const { combat } = createCombatService({});
    await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        loadout: {
          pocket: [
            {
              itemId: 100_011,
              artifactId: 1,
              position: 1,
              count: 1,
              title: "kind11",
              picture: "x.png",
              spell: {
                flags: "0",
                persRestr: { dead: false },
                targetRestr: { dead: false },
                effects: [{ kind: 11 }],
              },
            },
          ],
          glove: null,
          gearSpells: [],
        },
      }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await expect(
      combat.execute(1, { kind: "pocket", itemId: 100_011, sequence: 2 }),
    ).rejects.toMatchObject({ deny: "kind11" });
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
  });
});

async function strikeAndLoop(
  combat: ReturnType<typeof createCombatService>["combat"],
  delay: ReturnType<typeof createCombatService>["delay"],
  clock: MutableClock,
  side: "left" | "center" | "right",
  sequence: number,
): Promise<void> {
  await combat.execute(1, { kind: "strike", side, sequence });
  await combat.execute(1, { kind: "poll" });
  clock.advanceMs(1400);
  await delay.fireDue(clock.now());
  await combat.execute(1, { kind: "poll" });
  clock.advanceMs(1100);
  await delay.fireDue(clock.now());
  await combat.execute(1, { kind: "poll" });
}
