import type { CombatPort } from "../../src/modules/combat/ports/combat-port.ts";

export async function startHuntWithIssuedId(
  combat: CombatPort,
  input: Omit<Parameters<CombatPort["startHunt"]>[0], "fightId">,
) {
  return combat.startHunt({ ...input, fightId: await combat.nextFightId() });
}
