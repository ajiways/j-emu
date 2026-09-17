import { describe, expect, it } from "vitest";
import type { CombatEvent } from "../../../src/modules/combat/ports/combat-port.ts";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { fightEventMap } from "../../../src/modules/jugger-wire/application/fight-event-map.ts";
import {
  FightTraceLog,
  fightTraceHp,
} from "../../../src/modules/jugger-wire/application/fight-trace-log.ts";

describe("FightTraceLog", () => {
  it("keeps empty polls compact", () => {
    expect(
      FightTraceLog.record({
        channel: "http",
        accountId: 7,
        command: { kind: "poll" },
        request: null,
        events: [],
        frames: [],
      }),
    ).toEqual({
      event: "fight_trace",
      channel: "http",
      accountId: 7,
      kind: "poll",
      empty: true,
    });
  });

  it("dumps request, events, frames, and hp for a glove AOE poll", () => {
    const frames = [
      fightEventMap([
        {
          et: "persChangeInfo",
          id: 1_000_001,
          nick: "Clone",
          hp: 2,
          maxHp: 8,
          dead: false,
        },
        {
          animData: "magic_aoe_light",
          et: "cast",
          persId: 1,
          targetId: 1_000_000,
          maxHp: 8,
          ev: {
            "1": {
              et: "hpChange",
              persId: 1,
              targetId: 1_000_000,
              hp: -4,
              maxHp: 8,
            },
          },
        },
      ]),
    ];
    const events = [
      { type: "pers-change" },
      { type: "damage" },
    ] as unknown as readonly CombatEvent[];
    const recorded = FightTraceLog.record({
      channel: "http",
      accountId: 7,
      command: { kind: "glove", spellId: 9099, sequence: 4 },
      request: { rc: "castSpell", sourceId: 9099, sq: 4 },
      events,
      frames,
    });
    expect(recorded).toMatchObject({
      event: "fight_trace",
      channel: "http",
      accountId: 7,
      kind: "glove",
      command: { kind: "glove", spellId: 9099, sequence: 4 },
      request: { rc: "castSpell", sourceId: 9099, sq: 4 },
      eventTypes: ["pers-change", "damage"],
    });
    expect(fightTraceHp(frames)).toEqual([
      { et: "persChangeInfo", id: 1_000_001, nick: "Clone", hp: 2, maxHp: 8, dead: false },
      {
        et: "cast",
        persId: 1,
        targetId: 1_000_000,
        animData: "magic_aoe_light",
        maxHp: 8,
      },
      { et: "hpChange", persId: 1, targetId: 1_000_000, hp: -4, maxHp: 8 },
    ]);
  });

  it("decodes a non-empty HTTP fight body", () => {
    expect(
      FightTraceLog.requestOf(encodeAmf3({ rc: "castSpell", sourceId: 2, sq: 3 })),
    ).toMatchObject({ rc: "castSpell", sourceId: 2, sq: 3 });
    expect(FightTraceLog.requestOf(Buffer.alloc(0))).toBeNull();
  });
});
