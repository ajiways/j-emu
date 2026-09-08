import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";

export async function requireNoActiveFight(combat: CombatPort, accountId: number): Promise<void> {
  if ((await combat.activeFightId(accountId)) !== null) {
    throw new ProtocolError(203, "нельзя во время боя");
  }
}
