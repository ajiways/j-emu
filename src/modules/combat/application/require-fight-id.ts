import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export function requireFightId(fightId: string): string {
  return String(requireWireIdentity(Number(parseDecimalId(fightId, "fight id")), "fight id"));
}
