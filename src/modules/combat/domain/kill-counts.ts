import type { Participant } from "./participant.ts";

/** How many fighters each participant finished off, by participant id of the one who dealt the blow. */
export function killCountsOf(fighters: readonly Participant[]): ReadonlyMap<number, number> {
  const kills = new Map<number, number>();
  for (const fighter of fighters) {
    if (fighter.killedBy === null) continue;
    kills.set(fighter.killedBy, (kills.get(fighter.killedBy) ?? 0) + 1);
  }
  return kills;
}
