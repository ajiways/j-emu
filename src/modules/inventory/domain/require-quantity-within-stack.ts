import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";

export function requireQuantityWithinStack(definition: ArtifactDefinition, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Item quantity must be a positive integer");
  }
  if (quantity > definition.bagStack) {
    throw new Error(
      `Artifact ${definition.id} quantity ${quantity} exceeds bagStack ${definition.bagStack}`,
    );
  }
}
