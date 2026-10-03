import { describe, expect, it } from "vitest";
import type { FriendlyDuelStartInput } from "../../../src/modules/combat/ports/combat-port.ts";
import {
  EMPTY_COMBAT_LOADOUT,
  type CombatIdolRow,
} from "../../../src/modules/combat/domain/combat-loadout.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { UNIT_FIGHT_SECONDARIES } from "../../support/hunt-start-input.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";

const IDOL: CombatIdolRow = {
  itemId: 100_001,
  artifactId: 299,
  count: 1,
  title: "Идол",
  picture: "statuetka.png",
  spell: { mpCost: 0, effects: [{ kind: 10, botArtikulId: 550 }] },
  phantom: {
    artikulId: 550,
    nick: "Фантом",
    level: 1,
    strength: 1,
    initiative: 1,
    maxHp: 500,
    avatar: "avatar_garpina1_sm.jpg",
    sk: "52",
    body: "ghost(0,1,0)",
  },
};

function fighter(
  accountId: number,
  idols: readonly CombatIdolRow[],
  hp = 500,
): FriendlyDuelStartInput["challenger"] {
  return {
    accountId,
    heroId: accountId,
    heroNick: `H${accountId}`,
    heroLevel: 1,
    heroKind: 1,
    heroHp: hp,
    heroMaxHp: 500,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 10,
    ...UNIT_FIGHT_SECONDARIES,
    loadout: { ...EMPTY_COMBAT_LOADOUT, idols },
    avatar: "avatar_small.jpg",
    body: "m1",
    sk: "1",
  };
}

describe("a duel of two players with a summoned phantom", () => {
  it("puts the waiting phantom across from the player who struck enough, as it would a mob duel", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({ clock, random: new FixedRandom() });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: fighter(1, [IDOL]),
      acceptor: fighter(2, []),
    });
    for (const id of [1, 2]) {
      await combat.execute(id, { kind: "authenticate", fightId, sequence: 1 });
      await combat.execute(id, { kind: "poll" });
    }
    await combat.execute(1, { kind: "idol", itemId: 100_001, sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    let sequence = 3;
    const turn = async (id: number) => {
      await combat.execute(id, { kind: "strike", side: "center", sequence: sequence++ });
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
    };
    for (let round = 0; round < 3; round += 1) {
      await turn(1);
      await turn(2);
    }
    const first = await combat.execute(1, { kind: "poll" });
    const second = await combat.execute(2, { kind: "poll" });
    expect(first.map((event) => event.type)).toContain("opponent-wait");
    expect(second.map((event) => event.type)).toContain("opponent-new");
  });

  it("ends a duel in which a phantom stands by: the result is titled by the players", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat } = createCombatService({ clock, random: new FixedRandom() });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: fighter(1, [IDOL]),
      acceptor: fighter(2, [], 1),
    });
    for (const id of [1, 2]) {
      await combat.execute(id, { kind: "authenticate", fightId, sequence: 1 });
      await combat.execute(id, { kind: "poll" });
    }
    await combat.execute(1, { kind: "idol", itemId: 100_001, sequence: 2 });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 3 });
    expect((await combat.execute(1, { kind: "poll" })).map((event) => event.type)).toContain(
      "finished",
    );
    expect((await combat.execute(2, { kind: "poll" })).map((event) => event.type)).toContain(
      "finished",
    );
  });

  it("never sets a player against the phantom he called, however long the duel goes on", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({ clock, random: new FixedRandom() });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: fighter(1, [IDOL]),
      acceptor: fighter(2, []),
    });
    for (const id of [1, 2]) {
      await combat.execute(id, { kind: "authenticate", fightId, sequence: 1 });
      await combat.execute(id, { kind: "poll" });
    }
    await combat.execute(1, { kind: "idol", itemId: 100_001, sequence: 2 });
    let sequence = 3;
    const seenByCaller: string[] = [];
    for (let round = 0; round < 12; round += 1) {
      for (const id of [1, 2]) {
        await combat.execute(id, { kind: "strike", side: "center", sequence: sequence++ });
        clock.advanceMs(1400);
        await delay.fireDue(clock.now());
        clock.advanceMs(1100);
        await delay.fireDue(clock.now());
      }
      const events = await combat.execute(1, { kind: "poll" });
      seenByCaller.push(...events.map((event) => event.type));
      await combat.execute(2, { kind: "poll" });
    }
    // He steps out for the phantom once and waits: no one ever sets him across from it.
    expect(seenByCaller.filter((type) => type === "opponent-new")).toEqual([]);
  });

  it("sets the phantom across from the killer when the player who called it falls", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({ clock, random: new FixedRandom() });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: fighter(1, [IDOL], 1),
      acceptor: fighter(2, []),
    });
    for (const id of [1, 2]) {
      await combat.execute(id, { kind: "authenticate", fightId, sequence: 1 });
      await combat.execute(id, { kind: "poll" });
    }
    await combat.execute(1, { kind: "idol", itemId: 100_001, sequence: 2 });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 3 });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(2, { kind: "strike", side: "center", sequence: 2 });
    const fallen = (await combat.execute(1, { kind: "poll" })).map((event) => event.type);
    const killer = (await combat.execute(2, { kind: "poll" })).map((event) => event.type);
    expect(fallen).toContain("opponent-wait");
    expect(killer).toContain("opponent-new");
    expect(killer).not.toContain("finished");
  });
});
