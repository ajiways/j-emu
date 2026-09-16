import { describe, expect, it } from "vitest";
import { buildFightResultInfo } from "../../../src/modules/combat/domain/fight-result-info.ts";
import { fightLootBlock } from "../../../src/modules/combat/domain/fight-loot-block.ts";
import { fightInfoBlock } from "../../../src/modules/jugger-wire/application/fight-info-block.ts";

describe("fight result info", () => {
  it("builds a finished hunt snapshot after −1 second with loot on the winner", () => {
    const loot = fightLootBlock({
      fightId: "12",
      experience: 15,
      money: "0.2",
      items: [],
      artikulList: [],
    });
    const info = buildFightResultInfo({
      fightId: "12",
      title: "Нападение Ann на Грызль",
      type: "1",
      areaId: "503",
      timeout: 20,
      startedAt: new Date("2026-09-16T12:00:00"),
      now: new Date("2026-09-16T12:00:03"),
      winnerTeam: 1,
      humans: [
        {
          accountId: 7,
          heroId: 100,
          nick: "Ann",
          level: 1,
          kind: 1,
          team: 1,
          hp: 40,
          maxHp: 50,
          mp: 10,
          maxMp: 10,
          damageToBot: 12,
          damageToHumans: 0,
          leftLive: false,
        },
      ],
      bots: [
        {
          id: 1_000_000,
          nick: "Грызль",
          level: 1,
          hp: 0,
          maxHp: 30,
          artikulId: 2,
          avatar: "a",
          sk: "s",
          body: "",
          team: 2,
        },
      ],
      lootByAccount: new Map([[7, loot]]),
    });
    expect(info).toMatchObject({
      fightId: "12",
      started: "16.09 12:00",
      duration: "3",
      finished: 1,
      winnerTeam: "1",
    });
    expect(info.users[0]).toMatchObject({
      participantId: 100,
      nick: "Ann",
      exp: 15,
      money: 0.2,
      dmg: 12,
      killCount: 1,
      bot: false,
    });
    expect(info.users[1]).toMatchObject({
      participantId: 1_000_000,
      id: "2",
      bot: true,
      dead: true,
      nick: "Грызль",
    });
    const wire = fightInfoBlock(info, "Горное поселение");
    expect(wire.status).toBe(100);
    expect(wire.winner_team).toBe("1");
    expect(wire.fight).toMatchObject({
      id: "12",
      area: "Горное поселение",
      type: "1",
      finished: 1,
    });
    expect((wire.users as Record<string, { nick: string }>)["100"]?.nick).toBe("Ann");
    expect((wire.users as Record<string, { nick: string }>)["1000000"]?.nick).toBe("Грызль");
    expect(typeof wire.share).toBe("string");
    expect(String(wire.share)).toMatch(/^\[\[SHARE /);
    const macroses = requireRecord(wire.macroses, "macroses");
    const shareKey = String(wire.share).slice("[[SHARE ".length, -2);
    expect(requireRecord(macroses[shareKey], "SHARE").macro_type).toBe("SHARE");
    expect(requireRecord(macroses[shareKey], "SHARE").link).toBe("/fight_info.php?fight_id=12");
  });

  it("marks a last-leave snapshot unfinished and without a kill", () => {
    const info = buildFightResultInfo({
      fightId: "12",
      title: "Нападение Ann на Грызль",
      type: "1",
      areaId: "503",
      timeout: 20,
      startedAt: new Date("2026-09-16T12:00:00"),
      now: new Date("2026-09-16T12:00:00"),
      winnerTeam: 2,
      humans: [
        {
          accountId: 7,
          heroId: 100,
          nick: "Ann",
          level: 1,
          kind: 1,
          team: 1,
          hp: 40,
          maxHp: 50,
          mp: 10,
          maxMp: 10,
          damageToBot: 0,
          damageToHumans: 0,
          leftLive: true,
        },
      ],
      bots: [
        {
          id: 1_000_000,
          nick: "Грызль",
          level: 1,
          hp: 30,
          maxHp: 30,
          artikulId: 2,
          avatar: "a",
          sk: "s",
          body: "",
          team: 2,
        },
      ],
      lootByAccount: new Map(),
    });
    expect(info.finished).toBe(0);
    expect(info.duration).toBe("1");
    expect(info.users[0]).toMatchObject({ flee: true, killCount: 0, exp: 0 });
  });
});

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}
