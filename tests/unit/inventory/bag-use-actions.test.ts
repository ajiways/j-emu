import { describe, expect, it } from "vitest";
import { ArtifactUseAction } from "../../../src/modules/catalog/domain/artifact-use-action.ts";
import {
  FLAG_DROP,
  FLAG_SELL,
  FLAG_USE,
  bagActionsFor,
} from "../../../src/modules/inventory/domain/bag-actions.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

describe("bag USE actions", () => {
  it("sets actions=7 when artifact_actions has USE and slotMask is 0", () => {
    const meat = testArtifact({
      id: 77,
      slotMask: 0,
      useActions: {
        "20": new ArtifactUseAction("20", "ADD_HP", 30, 0, 1, "Съесть мясо"),
      },
    });
    expect(bagActionsFor(meat.slotMask, meat.useAction !== undefined)).toBe(
      FLAG_DROP | FLAG_SELL | FLAG_USE,
    );
    expect(bagActionsFor(meat.slotMask, meat.useAction !== undefined)).toBe(7);
  });

  it("does not set USE for empty artifact_actions", () => {
    const glove = testArtifact({ id: 9095, slotMask: 32, useActions: {} });
    expect(glove.useAction).toBeUndefined();
    expect(bagActionsFor(glove.slotMask, glove.useAction !== undefined)).toBe(11);
  });
});
