import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { bagItemByArtikulId } from "../support/harness/wire-payload.ts";
import { insertBagArtifacts } from "../support/postgres/insert-bag-artifacts.ts";
import { heroIdFrom } from "../support/harness/wire-payload.ts";

const TOKEN = "test-operator-token";
const slicePath = path.resolve(process.cwd(), "content/playable-slice.json");

describe("content editor HTTP", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("activates a new NPC 271 title through USE 584 and restart", async () => {
    const beforeSlice = fs.readFileSync(slicePath);
    const unauthorized = await application.http.inject({
      method: "GET",
      url: "/operator/content/status",
    });
    expect(unauthorized.statusCode).toBe(401);

    const status = await operator(application, "GET", "/operator/content/status");
    expect(status.statusCode).toBe(200);
    const active = jsonRecord(status.json());
    const expectedActiveReleaseId = requireString(active.id);
    const title = "Голова редактора";
    const current = await operator(
      application,
      "GET",
      "/operator/content/document?contentType=npc&contentKey=271",
    );
    expect(current.statusCode, JSON.stringify(current.json())).toBe(200);
    const pinned = jsonRecord(current.json());
    if (!Number.isInteger(pinned.version)) throw new Error("document version is missing");
    if (!pinned.document || typeof pinned.document !== "object" || Array.isArray(pinned.document)) {
      throw new Error("active NPC 271 document is missing");
    }
    const draft = await operator(application, "POST", "/operator/content/drafts", {
      contentType: "npc",
      contentKey: "271",
      document: { ...pinned.document, title },
      expectedVersion: pinned.version,
    });
    expect(draft.statusCode, JSON.stringify(draft.json())).toBe(200);
    const saved = jsonRecord(draft.json());
    const candidate = await operator(application, "POST", "/operator/content/candidates", {
      overlays: [
        {
          contentType: "npc",
          contentKey: "271",
          draftVersionId: requireString(saved.draftVersionId),
        },
      ],
      expectedActiveReleaseId,
    });
    expect(candidate.statusCode).toBe(200);
    const candidateId = requireString(jsonRecord(candidate.json()).candidateId);
    const validated = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/validate`,
    );
    expect(validated.statusCode).toBe(200);
    expect(jsonRecord(validated.json()).ok).toBe(true);
    const activated = await operator(
      application,
      "POST",
      `/operator/content/candidates/${candidateId}/activate`,
    );
    expect(activated.statusCode).toBe(200);
    expect(jsonRecord(activated.json()).releaseId).not.toBe(expectedActiveReleaseId);

    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = heroIdFrom(init);
    await insertBagArtifacts(heroId, [{ artifactId: 584, durability: 0, durabilityMax: 0 }]);
    const bag = await client.objectAction({ object: "common", action: "init", sq: 2 });
    const opened = await client.objectAction({
      object: "common",
      action: "action",
      form: { object_class: "ARTIFACT", object_id: requireNumber(bagItemByArtikulId(bag, 584).id) },
      sq: 3,
    });
    expect(opened["common|action"]).toEqual({ status: 100, action: "USE" });
    expect(record(opened["npc|info"], "npc|info").npc).toMatchObject({ id: 271, title });

    application = await harness.restart();
    const restarted = new AuthenticatedClient(application, client.cookie);
    const restored = await restarted.objectAction({ object: "common", action: "init", sq: 4 });
    const again = await restarted.objectAction({
      object: "common",
      action: "action",
      form: {
        object_class: "ARTIFACT",
        object_id: requireNumber(bagItemByArtikulId(restored, 584).id),
      },
      sq: 5,
    });
    expect(record(again["npc|info"], "restart npc|info").npc).toMatchObject({ id: 271, title });
    expect(fs.readFileSync(slicePath).equals(beforeSlice)).toBe(true);
  });
});

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

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected a string");
  return value;
}

function requireNumber(value: AmfValue | undefined): number {
  if (typeof value !== "number") throw new Error("expected a number");
  return value;
}

function record(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value;
}
