import type { FightStart } from "../../combat/ports/combat-port.ts";

export function pvpFightWireOverlay(
  start: FightStart,
): Readonly<{ instanceId: string; flags: string }> {
  if (start.instanceCopyId === null) throw new Error("PvP fight copy is required");
  if (start.fightFlags === null) throw new Error("PvP fight flags are required");
  return { instanceId: String(start.instanceCopyId), flags: start.fightFlags };
}
