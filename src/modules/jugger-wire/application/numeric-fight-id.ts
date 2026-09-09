import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export function numericFightId(fightId: string | null): number | null {
  if (fightId === null) return null;
  return requireWireIdentity(Number(parseDecimalId(fightId, "fight id")), "fight id");
}
