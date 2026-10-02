import { describe, expect, it } from "vitest";
import { pickExecutionAnimation } from "../../../src/modules/combat/domain/execution-animation.ts";
import type { RandomSource } from "../../../src/modules/combat/domain/random-source.ts";

/** The roll lands on the chosen end of the range. */
function rollingAt(end: "min" | "max"): RandomSource {
  return { integer: (min, max) => (end === "min" ? min : max), unit: () => 0.5 };
}

describe("the animation of an execution", () => {
  it("is the first blow until fifty executions unlock the next", () => {
    expect(pickExecutionAnimation(1, rollingAt("max"))).toBe("fatality1");
    expect(pickExecutionAnimation(49, rollingAt("max"))).toBe("fatality1");
    expect(pickExecutionAnimation(50, rollingAt("max"))).toBe("fatality2");
  });

  it("is a random one of everything unlocked", () => {
    expect(pickExecutionAnimation(100, rollingAt("min"))).toBe("fatality1");
    expect(pickExecutionAnimation(100, rollingAt("max"))).toBe("fatality3");
    expect(pickExecutionAnimation(700, rollingAt("max"))).toBe("fatality9");
    expect(pickExecutionAnimation(699, rollingAt("max"))).toBe("fatality8");
  });

  it("rejects a count that does not include the execution being carried out", () => {
    expect(() => pickExecutionAnimation(0, rollingAt("min"))).toThrow(/at least 1/);
  });
});
