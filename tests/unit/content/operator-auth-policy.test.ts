import { describe, expect, it } from "vitest";
import { OperatorAuthPolicy } from "../../../src/modules/content/application/operator-auth-policy.ts";

describe("OperatorAuthPolicy", () => {
  it("fails construction without a token", () => {
    expect(() => new OperatorAuthPolicy("")).toThrow(/CONTENT_OPERATOR_TOKEN/);
  });

  it("accepts only the exact Bearer token", () => {
    const policy = new OperatorAuthPolicy("secret-token");
    expect(policy.matches("Bearer secret-token")).toBe(true);
    expect(policy.matches("Bearer other-token")).toBe(false);
    expect(policy.matches("Bearer secret-token ")).toBe(false);
    expect(policy.matches("secret-token")).toBe(false);
    expect(policy.matches("Bearer ")).toBe(false);
    expect(policy.matches(undefined)).toBe(false);
  });
});
