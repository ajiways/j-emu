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

  it("wakes only the named account waiter", async () => {
    const coordinator = new LongPollCoordinator();
    const first = coordinator.wait(10_000, new AbortController().signal, 1);
    const second = coordinator.wait(10_000, new AbortController().signal, 2);
    const unscoped = coordinator.wait(10_000, new AbortController().signal);
    coordinator.wake(1);
    await expect(first).resolves.toBe("woken");
    coordinator.shutdown();
    await expect(second).resolves.toBe("shutdown");
    await expect(unscoped).resolves.toBe("shutdown");
  });

  it("rejects an invalid account id instead of inventing one", () => {
    const coordinator = new LongPollCoordinator();
    expect(() => coordinator.wait(10, new AbortController().signal, 0)).toThrow(/positive integer/);
    expect(() => coordinator.wake(0)).toThrow(/positive integer/);
  });
});
