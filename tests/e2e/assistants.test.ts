import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";

describe("assistant gathering", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, { farmRandom: { unit: () => 0.999 } });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("creates, farms, claims across restart, then upgrades 3 to 13", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await application.characterProfessions.learnProfession({
      characterId: heroId,
      professionId: 2,
    });
    await application.characterLocation.setArea({
      characterId: heroId,
      areaId: "500",
      moveReadyAt: null,
      instanceCopyId: null,
    });

    const created = await client.objectAction({
      object: "assistant",
      action: "create",
      artikul_id: 3,
      sq: 2,
    });
    expect(record(created["assistant|create"], "create").status).toBe(100);

    const info = await client.objectAction({ object: "assistant", action: "info", sq: 3 });
    const list = record(record(info["assistant|info"], "info").assistant_list, "assistant_list");
    const ids = Object.keys(list);
    expect(ids).toHaveLength(1);
    const assistantId = Number(ids[0]);
    const row = record(list[ids[0] ?? ""], "assistant");
    expect(row.artikul_id).toBe(3);
    expect(row.farm_id).toBe(0);
    expect(row.ftime).toBe(0);

    const saved = await client.objectAction({
      object: "assistant",
      action: "save",
      id: assistantId,
      tactics: 1,
      sq: 4,
    });
    expect(record(saved["assistant|save"], "save").status).toBe(100);

    const farmInfo = await client.objectAction({ object: "assistant", action: "farm_info", sq: 5 });
    const farms = record(
      record(farmInfo["assistant|farm_info"], "farm_info").farm_list,
      "farm_list",
    );
    expect(record(farms["4"], "farm 4").id).toBe(4);

    const work = await client.objectAction({
      object: "assistant",
      action: "work",
      id: assistantId,
      farm_id: 4,
      sq: 6,
    });
    const workBlock = record(work["assistant|work"], "work");
    expect(workBlock.status).toBe(100);
    expect(workBlock.ftime).toBeGreaterThan(0);

    const early = await client.objectAction({
      object: "assistant",
      action: "repeat",
      id: assistantId,
      sq: 7,
    });
    expect(record(early["assistant|repeat"], "early repeat")).toMatchObject({
      status: 2,
      error: "Ещё не готово",
    });

    await harness.elapseCombat(60_000);
    const frames = await client.pollEsrv();
    expect(esrvHas(frames, "assistant|farm_result")).toBe(true);

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const waiting = await again.objectAction({ object: "assistant", action: "info", sq: 20 });
    const waitingRow = record(
      record(record(waiting["assistant|info"], "restart info").assistant_list, "list")[
        String(assistantId)
      ],
      "waiting assistant",
    );
    expect(waitingRow.artikul_id).toBe(3);
    expect(waitingRow.result_value).toBe("1720");

    const repeated = await again.objectAction({
      object: "assistant",
      action: "repeat",
      id: assistantId,
      sq: 21,
    });
    expect(record(repeated["assistant|repeat"], "repeat").status).toBe(100);
    const bag = await again.objectAction({ object: "user", action: "bag", sq: 22 });
    expect(bagItemByArtikulId(bag, 1720).cnt).toBe(1);

    const revoked = await again.objectAction({
      object: "assistant",
      action: "revoke",
      id: assistantId,
      sq: 23,
    });
    expect(record(revoked["assistant|revoke"], "revoke").status).toBe(100);

    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1720,
      quantity: 179,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1721,
      quantity: 170,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1722,
      quantity: 170,
    });
    const upgraded = await again.objectAction({
      object: "assistant",
      action: "upgrade",
      id: assistantId,
      sq: 24,
    });
    expect(record(upgraded["assistant|upgrade"], "upgrade").status).toBe(100);
    const after = await again.objectAction({ object: "assistant", action: "info", sq: 25 });
    const nextList = record(
      record(after["assistant|info"], "after upgrade").assistant_list,
      "list",
    );
    const nextRow = record(Object.values(nextList)[0], "upgraded");
    expect(nextRow.artikul_id).toBe(13);
    const stats = await again.objectAction({ object: "user", action: "stats", sq: 26 });
    const farmStats = record(stats["user|stats"], "stats").farm_stats;
    if (!Array.isArray(farmStats) || farmStats.length < 1) {
      throw new Error("farm_stats after gathering are missing");
    }
  });
});

function record(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function esrvHas(frames: readonly AmfValue[], key: string): boolean {
  for (const frame of frames) {
    const row = record(frame, "esrv frame");
    const object = row.object;
    if (!object || typeof object !== "object" || Array.isArray(object)) continue;
    if (key in object) return true;
  }
  return false;
}
