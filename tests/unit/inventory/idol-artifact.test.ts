import { describe, expect, it } from "vitest";
import type { ArtifactDefinition } from "../../../src/modules/catalog/domain/artifact-definition.ts";
import { isIdolArtifact } from "../../../src/modules/inventory/domain/idol-artifact.ts";

function artifact(kindId: number, effectKind: number | null): ArtifactDefinition {
  return {
    kindId,
    extra: { spell: effectKind === null ? null : { effects: [{ kind: effectKind }] } },
  } as unknown as ArtifactDefinition;
}

describe("isIdolArtifact", () => {
  it("is an idol only when a kind-35 item has a summon spell", () => {
    expect(isIdolArtifact(artifact(35, 10))).toBe(true);
    expect(isIdolArtifact(artifact(35, 3))).toBe(false);
    expect(isIdolArtifact(artifact(35, null))).toBe(false);
    expect(isIdolArtifact(artifact(163, 10))).toBe(false);
  });
});
