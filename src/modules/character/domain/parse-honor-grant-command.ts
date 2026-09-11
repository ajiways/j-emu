import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { HonorGrantCommand } from "./honor-grant-command.ts";
import { InvalidHonorGrantError } from "./invalid-honor-grant-error.ts";

const OPERATION_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}:[A-Za-z0-9][A-Za-z0-9:._-]{0,94}$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function parseHonorGrantCommand(command: HonorGrantCommand): HonorGrantCommand {
  let characterId: number;
  try {
    characterId = requireWireIdentity(command.characterId, "character id");
  } catch (error) {
    throw new InvalidHonorGrantError(
      error instanceof Error ? error.message : "character id is invalid",
    );
  }
  if (typeof command.operationId !== "string" || !OPERATION_ID.test(command.operationId)) {
    throw new InvalidHonorGrantError("Honor grant operationId is invalid");
  }
  if (
    !Number.isInteger(command.amount) ||
    command.amount < 1 ||
    command.amount > POSTGRES_INTEGER_MAX
  ) {
    throw new InvalidHonorGrantError("Honor grant amount must be a positive integer");
  }
  return {
    characterId,
    operationId: command.operationId,
    amount: command.amount,
  };
}

export function requireHonorSum(currentHonor: number, amount: number): number {
  if (!Number.isInteger(currentHonor) || currentHonor < 0) {
    throw new InvalidHonorGrantError("Stored honor is not a valid integer");
  }
  if (amount > POSTGRES_INTEGER_MAX - currentHonor) {
    throw new InvalidHonorGrantError("Honor grant overflows the integer limit");
  }
  return currentHonor + amount;
}
