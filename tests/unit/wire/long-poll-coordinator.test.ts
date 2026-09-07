import { describe, expect, it } from "vitest";
import { LongPollCoordinator } from "../../../src/modules/jugger-wire/application/long-poll-coordinator.ts";

describe("LongPollCoordinator", () => {
  it("ends immediately when the client disconnects", async () => {
    const coordinator = new LongPollCoordinator();
    const controller = new AbortController();
    const waiting = coordinator.wait(10_000, controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBe("aborted");
  });

  it("rejects a missing or invalid timeout instead of inventing one", () => {
    const coordinator = new LongPollCoordinator();
    expect(() => coordinator.wait(0, new AbortController().signal)).toThrow(/positive integer/);
  });

  it("drains active waits during application shutdown", async () => {
    const coordinator = new LongPollCoordinator();
    const waiting = coordinator.wait(10_000, new AbortController().signal);
    coordinator.shutdown();
    await expect(waiting).resolves.toBe("shutdown");
  });
});
