import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { ManualCombatDelay } from "../support/fakes/manual-combat-delay.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { dungeonHuntId } from "../../src/modules/instance/domain/dungeon-hunt-id.ts";

const START_MS = 1_700_000_000_000;

const DUNGEONS = [
  {
    title: "kopi",
    artikul: "11",
    start: "654",
    parent: "541",
    botId: 354,
    spawnKey: "boss",
    exp: 3623,
    level: 7,
    parentFtimeSec: 30,
    durationMs: 7_200_000,
  },
  {
    title: "tomb",
    artikul: "12",
    start: "653",
    parent: "651",
    botId: 353,
    spawnKey: "boss",
    exp: 45_923,
    level: 10,
    parentFtimeSec: 0,
    durationMs: 7_200_000,
  },
  {
    title: "usadba",
    artikul: "14",
    start: "673",
    parent: "499",
    botId: 373,
    spawnKey: "boss",
    exp: 122_873,
    level: 12,
    parentFtimeSec: 0,
    durationMs: 7_200_000,
  },
] as const;

describe("dungeon bulk has_clear false", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock, new ManualCombatDelay());
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it.each(DUNGEONS)(
    "enters $title, lists the boss hunt, exits and rejoins the same copy",
    async (dungeon) => {
      const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
      const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
      const characterId = heroIdFrom(init);
      await grantLevel(application, characterId, dungeon.exp, dungeon.level);
      await application.characterLocation.setArea({
        characterId,
        areaId: dungeon.parent,
        moveReadyAt: null,
        instanceCopyId: null,
      });
      const entered = await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "COME_IN", area_id: Number(dungeon.start) },
        sq: 2,
      });
      expect(entered["common|action"]).toEqual({ status: 100, action: "COME_IN" });
      expect(objectBlock(entered.state).area_id).toBe(dungeon.start);
      expect(objectBlock(entered.state).instance).toBe(1);
      expect(entered["common|instance_conf"]).toEqual({
        artikul_id: dungeon.artikul,
        status: 100,
      });
      const copyId = copyIdFrom(entered);
      const hunt = objectBlock(entered["common|hunt"]);
      const bots = hunt.bots;
      if (!Array.isArray(bots) || bots.length !== 1) {
        throw new Error(`${dungeon.title} hunt list is missing`);
      }
      const boss = objectBlock(bots[0]);
      expect(boss.artikul_id).toBe(dungeon.botId);
      expect(boss.id).toBe(dungeonHuntId(copyId, dungeon.spawnKey));

      clock.advanceSeconds(30);
      const left = await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "COME_IN", area_id: Number(dungeon.parent) },
        sq: 3,
      });
      expect(objectBlock(left.state).area_id).toBe(dungeon.parent);
      expect(objectBlock(left.state).instance).toBe(0);
      expect(left["common|instance_conf"]).toBeUndefined();

      if (dungeon.parentFtimeSec > 0) clock.advanceSeconds(dungeon.parentFtimeSec);
      const again = await client.objectAction({
        object: "common",
        action: "action",
        form: { code: "COME_IN", area_id: Number(dungeon.start) },
        sq: 4,
      });
      expect(objectBlock(again.state).area_id).toBe(dungeon.start);
      expect(copyIdFrom(again)).toBe(copyId);
    },
  );

  it("denies kopi at level 1", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    await application.characterLocation.setArea({
      characterId: heroIdFrom(init),
      areaId: "541",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const denied = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 654 },
      sq: 2,
    });
    expect(denied["common|action"]).toEqual({
      status: 204,
      error: "Вход в данный инстанс доступен персонажам с 7 уровня!",
    });
  });

  it("kicks expired kopi occupants back to 541", async () => {
    const client = await AuthenticatedClient.login(application, uniqueDevelopmentSlot());
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const characterId = heroIdFrom(init);
    await grantLevel(application, characterId, 3623, 7);
    await application.characterLocation.setArea({
      characterId,
      areaId: "541",
      moveReadyAt: null,
      instanceCopyId: null,
    });
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 654 },
      sq: 2,
    });
    expect(objectBlock(entered.state).area_id).toBe("654");
    await harness.elapseCombat(7_200_000 + 15_000);
    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2.state).area_id).toBe("541");
    expect(objectBlock(init2.state).instance).toBe(0);
    clock.advanceSeconds(30);
    const denied = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 654 },
      sq: 22,
    });
    expect(denied["common|action"]).toEqual({
      status: 2,
      error: "Время жизни инстанса истекло. Дождитесь сброса сервера.",
    });
  });
});

async function grantLevel(
  application: Application,
  characterId: number,
  amount: number,
  expected: number,
): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `dng2:${characterId}:l${expected}`,
    amount,
  });
  if (granted.levelAfter !== expected) {
    throw new Error(`Expected level ${expected} after ${amount} EXP, got ${granted.levelAfter}`);
  }
}

function copyIdFrom(payload: Record<string, AmfValue>): number {
  const pop = objectBlock(payload["chat|area_population"]).population;
  if (!Array.isArray(pop) || !pop[0]) throw new Error("area population is missing");
  const id = objectBlock(pop[0]).instance_id;
  if (typeof id !== "number" || id < 1) throw new Error("instance copy id is missing");
  return id;
}

function objectBlock(value: AmfValue): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("wire object block is missing");
  }
  return value as Record<string, AmfValue>;
}
