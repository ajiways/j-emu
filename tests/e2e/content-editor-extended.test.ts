import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { createIsolatedHero } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { bagItemByArtikulId, heroIdFrom } from "../support/harness/wire-payload.ts";

const TOKEN = "test-operator-token";
const slicePath = path.resolve(process.cwd(), "content/playable-slice.json");
const START_MS = 1_700_000_000_000;
const LEVEL7_EXP = 3622;
const PRICE = 9;
const DUNGEON_TITLE = "Пещера редактора";
const RECIPE_TITLE = "Рецепт редактора";
const BG_TITLE = "Раскоп редактора";
const GLOVE_TITLE = "Перчатка редактора";
const FAIL_PLAQUE = "Не хватает частей для редактора";

describe("content editor extended types", () => {
  let harness: ApplicationHarness;
  let application: Application;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START_MS);
    harness = new ApplicationHarness(clock);
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("reads active documents, activates six overlays, and keeps them after restart", async () => {
    const beforeSlice = fs.readFileSync(slicePath);
    const unauthorized = await application.http.inject({
      method: "GET",
      url: "/operator/content/document?contentType=npc&contentKey=271",
    });
    expect(unauthorized.statusCode).toBe(401);

    const missing = await operator(
      application,
      "GET",
      "/operator/content/document?contentType=npc&contentKey=999",
    );
    expect(missing.statusCode).toBe(404);

    const unknown = await operator(
      application,
      "GET",
      "/operator/content/keys?contentType=not_a_type",
    );
    expect(unknown.statusCode).toBe(400);

    const lotKeys = await operator(
      application,
      "GET",
      "/operator/content/keys?contentType=store_lot",
    );
    expect(lotKeys.statusCode).toBe(200);
    expect(jsonRecord(lotKeys.json()).keys).toEqual(expect.arrayContaining(["504:80"]));

    const status = await operator(application, "GET", "/operator/content/status");
    const expectedActiveReleaseId = requireString(jsonRecord(status.json()).id);
    const overlays = [
      await overlay(application, "store_lot", "504:80", (document) => {
        const lot = objectRecord(document, "store_lot");
        return { ...lot, price: PRICE, pay: { ...objectRecord(lot.pay, "pay"), amount: PRICE } };
      }),
      await overlay(application, "dungeon", "1", (document) => ({
        ...objectRecord(document, "dungeon"),
        title: DUNGEON_TITLE,
      })),
      await overlay(application, "craft_recipe", "61", (document) => ({
        ...objectRecord(document, "craft_recipe"),
        title: RECIPE_TITLE,
      })),
      await overlay(application, "battleground", "general|2", (document) => ({
        ...objectRecord(document, "battleground"),
        title: BG_TITLE,
      })),
      await overlay(application, "artifact", "20546", (document) => ({
        ...objectRecord(document, "artifact"),
        title: GLOVE_TITLE,
      })),
      await overlay(application, "use_script", "2827", (document) => ({
        ...objectRecord(document, "use_script"),
        failPlaque: FAIL_PLAQUE,
      })),
    ];

    const candidate = await operator(application, "POST", "/operator/content/candidates", {
      overlays: overlays.map((row) => ({
        contentType: row.contentType,
        contentKey: row.contentKey,
        draftVersionId: row.draftVersionId,
      })),
      expectedActiveReleaseId,
    });
    expect(candidate.statusCode, JSON.stringify(candidate.json())).toBe(200);
    const candidateId = requireString(jsonRecord(candidate.json()).candidateId);
    const validated = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/validate`,
    );
    expect(jsonRecord(validated.json()).ok).toBe(true);
    const activated = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/activate`,
    );
    expect(activated.statusCode).toBe(200);
    expect(jsonRecord(activated.json()).releaseId).not.toBe(expectedActiveReleaseId);

    const client = await createIsolatedHero(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await grantLevel7(application, heroId);
    await application.characterProfessions.learnProfession({
      characterId: heroId,
      professionId: 6,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 20546,
      quantity: 1,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 2371,
      quantity: 1,
    });
    await application.inventory.grantToBag({
      characterId: heroId,
      artifactId: 1861,
      quantity: 1,
    });
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    expect(bagItemByArtikulId(bag, 20546).title).toBe(GLOVE_TITLE);

    const failed = await client.objectAction({
      object: "common",
      action: "action",
      form: {
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(bag, 2371).id),
      },
      sq: 3,
    });
    expect(failed["common|action"]).toEqual({ status: 203, error: FAIL_PLAQUE });

    const learned = await client.objectAction({
      object: "common",
      action: "action",
      form: {
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(bag, 1861).id),
      },
      sq: 4,
    });
    expect(learned["common|action"]).toEqual({ status: 100, action: "USE" });
    const recipes = objectRecord(learned["craft|user_recipes_list"], "craft|user_recipes_list");
    expect(recipes.status).toBe(100);
    expect(requireRecipe(recipes.recipes, 61).artikul_id).toBe(61);

    const listed = await client.objectAction({ object: "arena", action: "list", sq: 5 });
    const arena = objectRecord(listed["arena|list"], "arena|list");
    expect(arena.status).toBe(100);
    const raskop = amfList(arena.list, "arena|list.list").find(
      (row) => objectRecord(row, "arena row").id === 2,
    );
    expect(objectRecord(raskop, "Раскоп")).toMatchObject({ available: 1 });

    const shop = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 504 },
      sq: 6,
    });
    expect(shop["common|action"]).toEqual({ status: 100, action: "COME_IN" });
    const store = await client.objectAction({ object: "store", action: "list", sq: 7 });
    const lots = amfList(objectRecord(store["store|list"], "store|list").artikuls, "artikuls");
    const lot80 = lots.find((row) => objectRecord(row, "lot").lot_id === 80);
    expect(objectRecord(lot80, "lot 80").price).toBe(PRICE);
    await client.objectAction({ object: "common", action: "exit", sq: 8 });

    const gorge = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 501 },
      sq: 9,
    });
    expect(objectRecord(gorge.state, "gorge").area_id).toBe("501");
    clock.advanceSeconds(15);
    const entered = await client.objectAction({
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: 542 },
      sq: 10,
    });
    expect(objectRecord(entered.state, "ogre").area_id).toBe("542");
    expect(entered["common|instance_conf"]).toEqual({ artikul_id: "1", status: 100 });
    const chat = chatMessages(await client.pollEsrv());
    expect(chat.some((message) => String(message.msg).includes(DUNGEON_TITLE))).toBe(true);
    const book = await client.objectAction({ object: "book", action: "instances", sq: 11 });
    expect(objectRecord(book["book|instances"], "book|instances")).toMatchObject({
      status: 100,
      active: { "0": { artikul_id: "1" } },
    });

    application = await harness.restart();
    expect(await documentField(application, "store_lot", "504:80", "price")).toBe(PRICE);
    expect(await documentField(application, "dungeon", "1", "title")).toBe(DUNGEON_TITLE);
    expect(await documentField(application, "craft_recipe", "61", "title")).toBe(RECIPE_TITLE);
    expect(await documentField(application, "battleground", "general|2", "title")).toBe(BG_TITLE);
    expect(await documentField(application, "artifact", "20546", "title")).toBe(GLOVE_TITLE);
    expect(await documentField(application, "use_script", "2827", "failPlaque")).toBe(FAIL_PLAQUE);
    expect(fs.readFileSync(slicePath).equals(beforeSlice)).toBe(true);
  }, 90_000);

  it("does not move the active pointer when a candidate is invalid", async () => {
    const before = jsonRecord(
      (await operator(application, "GET", "/operator/content/status")).json(),
    );
    const quest = await overlay(application, "quest", "q_engine_board", (document) => ({
      ...objectRecord(document, "quest"),
      npcId: 99999,
    }));
    const built = await operator(application, "POST", "/operator/content/candidates", {
      overlays: [
        {
          contentType: "quest",
          contentKey: "q_engine_board",
          draftVersionId: quest.draftVersionId,
        },
      ],
      expectedActiveReleaseId: requireString(before.id),
    });
    const candidateId = requireString(jsonRecord(built.json()).candidateId);
    const report = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/validate`,
    );
    expect(jsonRecord(report.json()).ok).toBe(false);
    const activate = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/activate`,
    );
    expect(activate.statusCode).toBe(422);
    expect(jsonRecord(activate.json()).reportId).toBe(jsonRecord(report.json()).reportId);
    const after = jsonRecord(
      (await operator(application, "GET", "/operator/content/status")).json(),
    );
    expect(after.id).toBe(before.id);
  });
});

async function overlay(
  application: Application,
  contentType: string,
  contentKey: string,
  mutate: (document: unknown) => unknown,
): Promise<{ contentType: string; contentKey: string; draftVersionId: string }> {
  const current = await getDocument(application, contentType, contentKey);
  const draft = await operator(application, "POST", "/operator/content/drafts", {
    contentType,
    contentKey,
    document: mutate(current.document),
    expectedVersion: current.version,
  });
  expect(draft.statusCode, JSON.stringify(draft.json())).toBe(200);
  return {
    contentType,
    contentKey,
    draftVersionId: requireString(jsonRecord(draft.json()).draftVersionId),
  };
}

async function getDocument(
  application: Application,
  contentType: string,
  contentKey: string,
): Promise<{ document: unknown; version: number }> {
  const url =
    `/operator/content/document?contentType=${encodeURIComponent(contentType)}` +
    `&contentKey=${encodeURIComponent(contentKey)}`;
  const response = await operator(application, "GET", url);
  expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
  const body = jsonRecord(response.json());
  if (!Number.isInteger(body.version)) throw new Error("document version is missing");
  return { document: body.document, version: body.version as number };
}

async function documentField(
  application: Application,
  contentType: string,
  contentKey: string,
  field: string,
): Promise<unknown> {
  const current = await getDocument(application, contentType, contentKey);
  return objectRecord(current.document, contentType)[field];
}

async function grantLevel7(application: Application, characterId: number): Promise<void> {
  const granted = await application.characterProgression.grantExperience({
    characterId,
    operationId: `edt02:${characterId}:l7`,
    amount: LEVEL7_EXP,
  });
  if (granted.levelAfter !== 7) {
    throw new Error(`Expected level 7 after ${LEVEL7_EXP} EXP, got ${granted.levelAfter}`);
  }
}

async function operator(
  application: Application,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
) {
  return application.http.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { payload: Buffer.from(JSON.stringify(body)) }),
  });
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected a string");
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}

function requireRecipe(value: unknown, recipeId: number): Record<string, unknown> {
  if (!Array.isArray(value)) throw new Error("recipes list is missing");
  for (const row of value) {
    const recipe = objectRecord(row, "recipe");
    if (recipe.artikul_id === recipeId) return recipe;
  }
  throw new Error(`recipe ${recipeId} is missing`);
}

function amfList(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) return value;
  return Object.values(objectRecord(value, label));
}

function chatMessages(packets: readonly AmfValue[]): Array<Record<string, AmfValue>> {
  const rows: Array<Record<string, AmfValue>> = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    const block = object["chat|message"];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const message = (block as Record<string, AmfValue>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("chat|message.message is missing");
    }
    rows.push(message as Record<string, AmfValue>);
  }
  return rows;
}
