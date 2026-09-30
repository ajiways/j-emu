import type { BotFighter } from "../../src/modules/combat/domain/bot-fighter.ts";
import type { HumanFighter } from "../../src/modules/combat/domain/human-fighter.ts";
import { Roster } from "../../src/modules/combat/domain/roster.ts";

/** A roster of the given players and mobs, as a fight that is under test has one. */
export function rosterOf(humans: readonly HumanFighter[], bots: readonly BotFighter[]): Roster {
  const roster = new Roster();
  for (const participant of [...humans, ...bots]) roster.add(participant);
  return roster;
}
