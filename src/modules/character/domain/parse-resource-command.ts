import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { InvalidResourceCommandError } from "./invalid-resource-command-error.ts";

export function parseCharacterId(characterId: number): number {
  try {
    return requireWireIdentity(characterId, "character id");
  } catch (error) {
    throw new InvalidResourceCommandError(
      error instanceof Error ? error.message : "character id is invalid",
    );
  }
}
