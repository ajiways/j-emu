import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { huntFightBootstrapEvents } from "../../../src/modules/jugger-wire/application/hunt-fight-bootstrap-wire.ts";

const hero = {
  id: 1,
  nick: "Hero",
  level: 1,
  kind: 1,
  hp: 27,
  maxHp: 27,
  mp: 10,
  maxMp: 10,
  team: 1 as const,
};
const bot = {
  id: 1_000_000,
  nick: "Грызль",
  level: 1,
  hp: 20,
  maxHp: 20,
  artikulId: 2,
  avatar: "avatar_gryzl1_sm.jpg",
  sk: "11",
  body: "",
  team: 2 as const,
};

describe("huntFightBootstrapEvents", () => {
  it("emits oppwait then oppnew on first paired entry", () => {
    const types = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      hero,
      allies: [],
      bot,
      rosterBots: [bot],
      cp: 0,
      cpHits: [],
      rage: 0,
      aggro: 1,
      loadout: EMPTY_COMBAT_LOADOUT,
      heroEffects: [],
    }).map((event) => event.et);
    expect(types).toEqual(expect.arrayContaining(["fightState", "persList", "oppwait", "oppnew"]));
  });

  it("skips oppwait on a paired resume", () => {
    const types = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      resumePaired: true,
      hero,
      allies: [],
      bot,
      rosterBots: [bot],
      cp: 0,
      cpHits: [],
      rage: 0,
      aggro: 1,
      loadout: EMPTY_COMBAT_LOADOUT,
      heroEffects: [],
    }).map((event) => event.et);
    expect(types).toContain("oppnew");
    expect(types).not.toContain("oppwait");
  });

  it("emits human oppnew when the hunter is paired with a person", () => {
    const types = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      hero,
      allies: [],
      bot,
      humanOpponent: { ...hero, id: 2, nick: "Waiter", team: 1 },
      humanOpponentAppearance: {
        avatar: "hero_1_sm.jpg",
        body: "m1",
        sk: "11",
      },
      rosterBots: [bot],
      cp: 0,
      cpHits: [],
      rage: 0,
      aggro: 1,
      loadout: EMPTY_COMBAT_LOADOUT,
      heroEffects: [],
    }).map((event) => event.et);
    expect(types).toEqual(expect.arrayContaining(["oppwait", "oppnew"]));
    const oppnew = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      hero,
      allies: [],
      bot,
      humanOpponent: { ...hero, id: 2, nick: "Waiter", team: 1 },
      humanOpponentAppearance: {
        avatar: "hero_1_sm.jpg",
        body: "m1",
        sk: "11",
      },
      rosterBots: [bot],
      cp: 0,
      cpHits: [],
      rage: 0,
      aggro: 1,
      loadout: EMPTY_COMBAT_LOADOUT,
      heroEffects: [],
    }).find((event) => event.et === "oppnew");
    expect(oppnew).toMatchObject({ id: 2, nick: "Waiter" });
    expect(oppnew).not.toHaveProperty("bot");
  });
});
