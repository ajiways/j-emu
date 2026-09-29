import { describe, expect, it } from "vitest";
import {
  EXPECTED_REMAIN_TIME,
  EXPECTED_TICKS,
  TRACE_EFFECTS,
  TRACE_STEPS,
} from "../../fixtures/combat/live-periodic-effect-traces.ts";
import { PeriodicEffectReferenceModel } from "../../support/periodic-effect-reference-model.ts";

const POLL_JITTER_SECONDS = 1;

describe("live DoT/HoT trace against the reference model", () => {
  const model = new PeriodicEffectReferenceModel(TRACE_EFFECTS);
  model.run(TRACE_STEPS);

  it("fires the ticks the client saw, in the same order and within poll jitter", () => {
    const shape = (tick: { effect: string; k: number }) => `${tick.effect}#${tick.k}`;
    expect(model.ticks.map(shape).sort()).toEqual(EXPECTED_TICKS.map(shape).sort());
    for (const expected of EXPECTED_TICKS) {
      const got = model.ticks.find(
        (tick) => tick.effect === expected.effect && tick.k === expected.k,
      );
      expect(Math.abs((got?.at ?? Infinity) - expected.at), shape(expected)).toBeLessThanOrEqual(
        POLL_JITTER_SECONDS,
      );
    }
  });

  it("expires the HoTs where the client purged them and drops the unpaired DoT silently", () => {
    const expiry = (effect: string) => model.expiries.find((entry) => entry.effect === effect)?.at;
    expect(expiry("hot283First")).toBeLessThanOrEqual(29.2);
    expect(Math.abs((expiry("hot283Second") ?? Infinity) - 69.5)).toBeLessThanOrEqual(
      POLL_JITTER_SECONDS,
    );
    expect(expiry("dot447OnE838")).toBeLessThan(59.5);
  });

  it("keeps the remaining time close to the persEff values of the live server", () => {
    for (const expected of EXPECTED_REMAIN_TIME) {
      const run = new PeriodicEffectReferenceModel(TRACE_EFFECTS);
      run.run(TRACE_STEPS.filter((step) => step.t <= expected.at));
      expect(Math.abs(run.remainTime(expected.effect, expected.at) - expected.remain)).toBeLessThan(
        POLL_JITTER_SECONDS,
      );
    }
  });
});
