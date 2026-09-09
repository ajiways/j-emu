import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("user stats reputation", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("omits type:2 until grant 5, then persists SUM 10 across restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const conf = requireRecord(init["user|conf"], "user|conf");
    if (typeof conf.id !== "number") throw new Error("user|conf.id is missing");

    const empty = await client.objectAction({ object: "user", action: "stats", sq: 2 });
    const before = requireRecord(empty["user|stats"], "user|stats");
    expect(before.status).toBe(100);
    expect(before.farm_stats).toEqual([]);
    expect(before.fish_stats).toEqual([]);
    expect(statIds(before.stats)).toEqual(["1", "2", "3", "4", "8", "36", "49"]);
    expect(statsOfType(before.stats, 2)).toEqual([]);
    expect(stat(before.stats, "1")).toMatchObject({ title: "Опыт", type: 1, value: 1 });
    expect(stat(before.stats, "2")).toMatchObject({ title: "Героизм", type: 1, value: 0 });
    expect(stat(before.stats, "36")).toMatchObject({
      title: "Суммарная репутация",
      type: 3,
      value: 0,
      image: "",
      type_id: "13",
    });
    expect(stat(before.stats, "49")).toMatchObject({ title: "Убито врагов за день", value: 0 });

    const granted = await application.characterReputation.grantReputation({
      characterId: conf.id,
      objectId: 5,
      amount: 10,
      cap: 0,
    });
    expect(granted).toEqual({ objectId: 5, value: 10, total: 10 });

    const afterGrant = await client.objectAction({ object: "user", action: "stats", sq: 3 });
    const after = requireRecord(afterGrant["user|stats"], "user|stats");
    expect(statIds(after.stats)).toEqual(["1", "2", "3", "4", "8", "5", "36", "49"]);
    expect(stat(after.stats, "5")).toMatchObject({
      title: "Репутация Радвея",
      type: 2,
      value: 10,
      image: "rep_radvey_sm.png",
      type_id: "13",
      object_id: "5",
    });
    expect(stat(after.stats, "36").value).toBe(10);

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const restored = await restarted.objectAction({ object: "user", action: "stats", sq: 20 });
    const again = requireRecord(restored["user|stats"], "user|stats");
    expect(stat(again.stats, "5").value).toBe(10);
    expect(stat(again.stats, "36").value).toBe(10);
  });
});

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireStats(value: AmfValue | undefined): Record<string, AmfValue>[] {
  if (!Array.isArray(value)) throw new Error("user|stats.stats must be an array");
  return value.map((entry, index) => requireRecord(entry, `user|stats.stats.${index}`));
}

function statIds(value: AmfValue | undefined): string[] {
  return requireStats(value).map((row) => {
    if (typeof row.object_id !== "string") throw new Error("object_id is missing");
    return row.object_id;
  });
}

function statsOfType(value: AmfValue | undefined, type: number): Record<string, AmfValue>[] {
  return requireStats(value).filter((row) => row.type === type);
}

function stat(value: AmfValue | undefined, objectId: string): Record<string, AmfValue> {
  const row = requireStats(value).find((entry) => entry.object_id === objectId);
  if (!row) throw new Error(`stat ${objectId} is missing`);
  return row;
}
