import { describe, expect, it } from "vitest";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";

const mapper = new FightWireMapper(
  { host: "s1.jugger.ru", port: 33120, proxyPath: "https://s1.jugger.ru/fproxy//;" },
  {
    autoFight: 0,
    canLeave: 1,
    companionEnabled: 0,
    isPvp: 0,
    instanceId: "0",
    type: "1",
    isSlaughter: false,
    flags: "0",
  },
);

describe("FightWireMapper keep-turn frames", () => {
  it("puts rs before pocket 93 FX and 99 ev:[]", () => {
    const elixir = mapper.frames([
      { type: "command-accepted", sequence: 2 },
      {
        type: "effect-use",
        artikulId: 93,
        animation: "botles_healself_grey",
        kind: 2,
        groupId: 841,
        flags: "262144",
        img: "bottles_live1_2712.png",
        title: "Малый эликсир жизни",
        persId: 1,
      },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1,
        animation: "botles_healself_grey",
        hpChange: 0,
        targetMaxHp: 27,
        killed: false,
      },
    ]);
    expect(elixir[0]).toEqual({ rs: true, sq: 2 });
    expect(evTypes(elixir[1])).toEqual(["effUse", "cast"]);

    const orb = mapper.frames([
      { type: "command-accepted", sequence: 3 },
      {
        type: "effect-use",
        artikulId: 99,
        animation: "botles_strenght_grey",
        kind: 3,
        groupId: 842,
        flags: "262144",
        img: "bottles_sila1.png",
        title: "Малый усиливающий орб",
        persId: 1,
        dmgType: 1,
        id: 1,
        remainTime: 40,
        sourceId: 1,
      },
      {
        type: "buff-cast",
        animation: "botles_strenght_grey",
        sourceId: 1,
        targetId: 1,
        maxHp: 27,
      },
    ]);
    expect(orb[0]).toEqual({ rs: true, sq: 3 });
    expect(castPacket(orb[1])).toMatchObject({ et: "cast", ev: [] });
    expect(Object.values(evMap(orb[1])).find((packet) => packet.et === "effUse")).toMatchObject({
      et: "effUse",
      id: 1,
      remainTime: 40,
      sourceId: 1,
      artikulId: 99,
    });
    expect(JSON.stringify(orb)).not.toContain("persSpells");
  });

  it("puts rs before rage fury and aggro absolute count", () => {
    const rage = mapper.frames([
      { type: "command-accepted", sequence: 4 },
      {
        type: "effect-use",
        artikulId: 212,
        animation: "fury",
        kind: 3,
        groupId: 844,
        flags: "0",
        img: "rageeffect_2702.png",
        title: "Ярость",
        persId: 1,
        dmgType: 1,
      },
      { type: "buff-cast", animation: "fury", sourceId: 1, targetId: 1, maxHp: 27 },
    ]);
    expect(rage[0]).toEqual({ rs: true, sq: 4 });
    expect(evTypes(rage[1])).toEqual(["effUse", "cast"]);

    const aggro = mapper.frames([
      { type: "command-accepted", sequence: 5 },
      {
        type: "native-count",
        srcId: 7,
        count: 0,
        title: "Разозлить",
        loadout: {
          pocket: [],
          gearSpells: [],
          glove: {
            hits: [2, 3, 2],
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
      },
    ]);
    expect(aggro[0]).toEqual({ rs: true, sq: 5 });
    expect(aggro[1]).toMatchObject({
      ev: {
        "1": {
          et: "persSpells",
          "6": { srcId: 7, count: 0 },
          "7": { srcType: 3, srcId: 9098, artikulId: 9098 },
        },
      },
    });
  });

  it("puts rs before ending glove attackwait and keeps melee strike-then-rs", () => {
    const ending = mapper.frames([
      { type: "command-accepted", sequence: 6 },
      { type: "turn-wait", timeoutSeconds: 20 },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_000,
        animation: "magic_electroball",
        hpChange: -8,
        targetMaxHp: 20,
        killed: false,
        comboCp: 0,
      },
    ]);
    expect(ending[0]).toEqual({ rs: true, sq: 6 });
    expect(evTypes(ending[1])).toEqual(["attackwait", "cast", "persCP"]);

    const melee = mapper.frames([
      { type: "turn-wait", timeoutSeconds: 20 },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_000,
        animation: "attack_left",
        hpChange: -8,
        targetMaxHp: 20,
        killed: false,
      },
      { type: "command-accepted", sequence: 2 },
    ]);
    expect(evTypes(melee[0])).toEqual(["attackwait", "cast"]);
    expect(melee[1]).toEqual({ rs: true, sq: 2 });

    const purged = mapper.frames([
      { type: "turn-wait", timeoutSeconds: 20 },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_000,
        animation: "attack_left",
        hpChange: -1,
        targetMaxHp: 20,
        killed: false,
      },
      { type: "effect-purge", effectId: 1 },
      { type: "command-accepted", sequence: 3 },
    ]);
    expect(evTypes(purged[0])).toEqual(["attackwait", "cast", "effPurge"]);
    expect(purged[1]).toEqual({ rs: true, sq: 3 });
    expect(JSON.stringify(purged)).not.toContain("timeAdvance");
  });

  it("puts empty-anim DoT ticks as sibling hpChange on the melee map", () => {
    const frames = mapper.frames([
      { type: "turn-wait", timeoutSeconds: 20 },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_000,
        animation: "attack_left",
        hpChange: -8,
        targetMaxHp: 20,
        killed: false,
      },
      {
        type: "damage",
        sourceId: 1_000_000,
        targetId: 1,
        animation: "",
        hpChange: -1,
        targetMaxHp: 27,
        killed: false,
        dmgType: 64,
        react: 2,
      },
      { type: "effect-purge", effectId: 1 },
      { type: "command-accepted", sequence: 4 },
    ]);
    expect(evTypes(frames[0])).toEqual(["attackwait", "cast", "hpChange", "effPurge"]);
    expect(castPacket(frames[0])).toMatchObject({
      et: "cast",
      animData: "attack_left",
      persId: 1,
      targetId: 1_000_000,
    });
    expect(Object.values(evMap(frames[0]))[2]).toMatchObject({
      et: "hpChange",
      persId: 1_000_000,
      targetId: 1,
      hp: -1,
      dmgType: 64,
      maxHp: 27,
    });
    expect(frames[1]).toEqual({ rs: true, sq: 4 });
  });

  it("packs bot overlay purge on the melee map", () => {
    const frames = mapper.frames([
      {
        type: "damage",
        sourceId: 1_000_000,
        targetId: 1,
        animation: "attack_center",
        hpChange: -2,
        targetMaxHp: 24,
        killed: false,
        extraHits: [{ hpChange: -1, dmgType: 64, react: 2, killed: false }],
      },
      { type: "effect-purge", effectId: 2 },
    ]);
    expect(evTypes(frames[0])).toEqual(["cast", "effPurge"]);
  });

  it("maps pers-change to persChangeInfo for the sidebar", () => {
    const frames = mapper.frames([
      {
        type: "pers-change",
        humans: [
          {
            id: 1,
            nick: "Hero",
            level: 1,
            kind: 1,
            hp: 20,
            maxHp: 27,
            mp: 10,
            maxMp: 10,
            team: 1,
            dealtDamage: 8,
          },
        ],
        bots: [
          {
            id: 1_000_000,
            nick: "Грызль",
            level: 1,
            hp: 8,
            maxHp: 20,
            artikulId: 2,
            avatar: "avatar_gryzl1_sm.jpg",
            sk: "11",
            body: "",
            team: 2,
            dealtDamage: 2,
          },
        ],
      },
    ]);
    expect(evTypes(frames[0])).toEqual(["persChangeInfo", "persChangeInfo"]);
    const packets = Object.values(evMap(frames[0]));
    expect(packets[0]).toMatchObject({
      et: "persChangeInfo",
      id: 1,
      hp: 20,
      dead: false,
      dealtDamage: 8,
    });
    expect(packets[1]).toMatchObject({
      et: "persChangeInfo",
      id: 1_000_000,
      hp: 8,
      bot: true,
      dead: false,
      dealtDamage: 2,
    });
  });

  it("keeps caster ST then persChangeInfo for AOE extra targets", () => {
    const frames = mapper.frames([
      { type: "command-accepted", sequence: 7 },
      {
        type: "pers-change",
        humans: [
          {
            id: 1,
            nick: "Hero",
            level: 1,
            kind: 1,
            hp: 27,
            maxHp: 27,
            mp: 10,
            maxMp: 10,
            team: 1,
            dealtDamage: 0,
          },
        ],
        bots: [
          {
            id: 1_000_000,
            nick: "Грызль",
            level: 1,
            hp: 164,
            maxHp: 200,
            artikulId: 2,
            avatar: "avatar_gryzl1_sm.jpg",
            sk: "11",
            body: "",
            team: 2,
            dealtDamage: 0,
          },
          {
            id: 1_000_001,
            nick: "Грызль",
            level: 1,
            hp: 196,
            maxHp: 200,
            artikulId: 2,
            avatar: "avatar_gryzl1_sm.jpg",
            sk: "11",
            body: "",
            team: 2,
            dealtDamage: 0,
          },
        ],
      },
      { type: "turn-wait", timeoutSeconds: 20 },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_000,
        animation: "magic_aoe_light",
        hpChange: -4,
        targetMaxHp: 200,
        killed: false,
        comboCp: 0,
      },
    ]);
    expect(frames[0]).toEqual({ rs: true, sq: 7 });
    expect(evTypes(frames[1])).toEqual([
      "attackwait",
      "persChangeInfo",
      "persChangeInfo",
      "persChangeInfo",
      "cast",
      "persCP",
    ]);
    expect(castPacket(frames[1])).toMatchObject({
      et: "cast",
      animData: "magic_aoe_light",
      targetId: 1_000_000,
    });
  });

  it("puts ally persChangeInfo in the same map before magic_aoe cast", () => {
    const frames = mapper.frames([
      {
        type: "pers-change",
        humans: [
          {
            id: 1,
            nick: "Hero",
            level: 1,
            kind: 1,
            hp: 27,
            maxHp: 27,
            mp: 10,
            maxMp: 10,
            team: 1,
            dealtDamage: 0,
          },
        ],
        bots: [
          {
            id: 1_000_000,
            nick: "Грызль",
            level: 1,
            hp: 164,
            maxHp: 200,
            artikulId: 2,
            avatar: "avatar_gryzl1_sm.jpg",
            sk: "11",
            body: "",
            team: 2,
            dealtDamage: 0,
          },
          {
            id: 1_000_001,
            nick: "Грызль",
            level: 1,
            hp: 196,
            maxHp: 200,
            artikulId: 2,
            avatar: "avatar_gryzl1_sm.jpg",
            sk: "11",
            body: "",
            team: 2,
            dealtDamage: 0,
          },
        ],
      },
      {
        type: "damage",
        sourceId: 1,
        targetId: 1_000_001,
        animation: "magic_aoe_light",
        hpChange: -4,
        targetMaxHp: 200,
        killed: false,
      },
    ]);
    expect(evTypes(frames[0])).toEqual([
      "persChangeInfo",
      "persChangeInfo",
      "persChangeInfo",
      "cast",
    ]);
    expect(castPacket(frames[0])).toMatchObject({
      et: "cast",
      animData: "magic_aoe_light",
      targetId: 1_000_001,
    });
  });
});

function evMap(frame: unknown): Record<string, { et?: string; ev?: unknown }> {
  if (!frame || typeof frame !== "object" || !("ev" in frame)) {
    throw new Error("expected an ev fight frame");
  }
  const ev = frame.ev;
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) throw new Error("ev map is missing");
  return ev as Record<string, { et?: string; ev?: unknown }>;
}

function evTypes(frame: unknown): string[] {
  return Object.values(evMap(frame)).map((packet) => {
    if (typeof packet.et !== "string") throw new Error("et is missing");
    return packet.et;
  });
}

function castPacket(frame: unknown): { et?: string; ev?: unknown } {
  const cast = Object.values(evMap(frame)).find((packet) => packet.et === "cast");
  if (!cast) throw new Error("cast packet is missing");
  return cast;
}
