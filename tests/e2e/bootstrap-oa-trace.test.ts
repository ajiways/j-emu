import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

/**
 * Client bootstrap after SWF load (accountId=1 CEF trace, 2026-09-07),
 * matching jgr-emu handlers for the same OA keys.
 */
const bootstrapProbe = [
  { object: "common", action: "init" },
  { object: "common", action: "init2" },
  { object: "common", action: "conf" },
  { object: "user", action: "unitframe" },
  { object: "user", action: "view" },
  { object: "user", action: "magic" },
  { object: "chat", action: "conf" },
  { object: "user", action: "flash_message" },
  { object: "companion", action: "list_user_companions" },
  { object: "craft", action: "user_recipes_list" },
  { object: "common", action: "menu_link_status" },
  { object: "battlepass", action: "list" },
  { object: "book", action: "quest_list", form: { filter_type: "started" } },
  { object: "jail", action: "list" },
] as const;

describe("bootstrap OA probe", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns status 100 for the CEF bootstrap burst", async () => {
    const client = await AuthenticatedClient.login(application);
    const trace: Array<{ key: string; status: number | null }> = [];
    for (const [index, call] of bootstrapProbe.entries()) {
      const payload = await client.objectAction({ ...call, sq: index + 1 });
      const key = `${call.object}|${call.action}`;
      trace.push({ key, status: statusOf(payload[key]) });
    }
    expect(trace.every((entry) => entry.status === 100)).toBe(true);
  });
});

function statusOf(block: AmfValue | undefined): number | null {
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const status = block["status"];
  return typeof status === "number" ? status : null;
}
