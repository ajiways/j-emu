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
  dealtDamage: 0,
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
  dealtDamage: 0,
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
      otherEffects: [],
      botEffects: [],
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
      otherEffects: [],
      botEffects: [],
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
      otherEffects: [],
      botEffects: [],
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
      otherEffects: [],
      botEffects: [],
    }).find((event) => event.et === "oppnew");
    expect(oppnew).toMatchObject({ id: 2, nick: "Waiter" });
    expect(oppnew).not.toHaveProperty("bot");
  });

  it("includes srcType 3 glove spells and cpHits from the loadout", () => {
    const hits = [2, 3, 2, 3, 1, 2, 3, 1] as const;
    const events = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      hero,
      allies: [],
      bot,
      rosterBots: [bot],
      cp: 0,
      cpHits: hits,
      rage: 0,
      aggro: 1,
      loadout: {
        pocket: [],
        gearSpells: [],
        glove: {
          hits,
          spells: [
            {
              artikulId: 9098,
              cost: 2,
              row: 1,
              title: "Разряд молнии",
              picture: "electro_ball1.png",
              spell: {
                persRestr: { active: true, dead: false },
                targetRestr: { opp: true, dead: false },
                effects: [{ kind: 1, dmgType: 128 }],
              },
            },
          ],
        },
      },
      heroEffects: [],
      otherEffects: [],
      botEffects: [],
    });
    expect(events.find((event) => event.et === "persSelf")).toMatchObject({ cpHits: [...hits] });
    const persSpells = events.find((event) => event.et === "persSpells");
    expect(persSpells).toEqual(
      expect.objectContaining({
        "7": expect.objectContaining({
          srcType: 3,
          srcId: 9098,
          artikulId: 9098,
          cpCost: 2,
          img: "electro_ball1.png",
        }),
      }),
    );
  });

  it("emits persEff then standing effUse for other humans before oppnew", () => {
    const fx = {
      id: 2,
      kind: 3,
      sourceId: 2,
      artikulId: 99,
      title: "Малый усиливающий орб",
      img: "bottles_sila1.png",
      dmgType: 1,
      remainTime: 40,
      groupId: 842,
      skills: {},
    };
    const types = huntFightBootstrapEvents({
      type: "hunt-bootstrap",
      waiting: false,
      hero,
      allies: [{ ...hero, id: 2, nick: "Waiter" }],
      bot,
      rosterBots: [bot],
      cp: 0,
      cpHits: [],
      rage: 0,
      aggro: 1,
      loadout: EMPTY_COMBAT_LOADOUT,
      heroEffects: [],
      otherEffects: [{ persId: 2, effects: [fx] }],
      botEffects: [],
    }).map((event) => event.et);
    expect(types).toEqual([
      "fightState",
      "persList",
      "persSelf",
      "persSpells",
      "persEff",
      "persEff",
      "effUse",
      "oppwait",
      "oppnew",
      "persEff",
    ]);
  });

  it("nests img on the foe persEff after oppnew", () => {
    const fx = {
      id: 3,
      kind: 3,
      sourceId: 1_000_000,
      artikulId: 397,
      title: "Смертельное прикосновение",
      img: "hissa_magic1.png",
      dmgType: 64,
      remainTime: 40,
      groupId: 845,
      skills: {},
    };
    const events = huntFightBootstrapEvents({
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
      otherEffects: [],
      botEffects: [fx],
    });
    const oppAt = events.findIndex((event) => event.et === "oppnew");
    expect(events[oppAt + 1]).toMatchObject({
      et: "persEff",
      persId: bot.id,
      "1": expect.objectContaining({ img: "hissa_magic1.png", artikulId: 397 }),
    });
    expect(events[oppAt + 2]).toMatchObject({
      et: "effUse",
      img: "hissa_magic1.png",
      artikulId: 397,
      persId: bot.id,
    });
  });
});
