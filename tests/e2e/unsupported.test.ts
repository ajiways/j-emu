import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

describe("unsupported object-action", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns status 203 for clan|info", async () => {
    const client = await AuthenticatedClient.login(application);
    const unsupported = await client.objectAction({ object: "clan", action: "info", sq: 3 });
    expect(unsupported["clan|info"]).toEqual({
      status: 203,
      error: "clan|info is not implemented",
    });
  });
});
