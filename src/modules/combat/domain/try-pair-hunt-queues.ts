import { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function requireDuelContaining(duels: readonly FightDuel[], id: number): FightDuel {
  const duel = duels.find((entry) => entry.has(id));
  if (!duel) throw new Error(`No duel contains participant ${id}`);
  return duel;
}

export function pairHuntHumanQueues(
  humans: readonly HuntHuman[],
  duels: FightDuel[],
): FightDuel | null {
  let created: FightDuel | null = null;
  for (;;) {
    const next = pairOneHuntHumanQueue(humans, duels);
    if (!next) return created;
    created = next;
  }
}

export function dissolveDuelContaining(
  duels: FightDuel[],
  humans: readonly HuntHuman[],
  participantId: number,
): void {
  const index = duels.findIndex((duel) => duel.has(participantId));
  if (index < 0) return;
  const duel = duels[index];
  if (!duel) return;
  const other = humans.find((human) => human.heroId === duel.otherId(participantId));
  if (other && !other.waiting && other.hp > 0 && !other.leftLive) other.unpair();
  duels.splice(index, 1);
}

function pairOneHuntHumanQueue(humans: readonly HuntHuman[], duels: FightDuel[]): FightDuel | null {
  const occupied = new Set<number>();
  for (const duel of duels) {
    occupied.add(duel.aId);
    occupied.add(duel.bId);
  }
  const team1 = unpairedSeeker(humans, 1, occupied);
  const team2 = unpairedSeeker(humans, 2, occupied);
  if (!team1 || !team2) return null;
  team1.pair();
  team2.pair();
  const duel = new FightDuel(team1.heroId, team2.heroId, team1.heroId);
  duels.push(duel);
  return duel;
}

function unpairedSeeker(
  humans: readonly HuntHuman[],
  team: 1 | 2,
  occupied: ReadonlySet<number>,
): HuntHuman | undefined {
  return humans.find(
    (human) =>
      human.team === team &&
      human.waiting &&
      !human.leftLive &&
      human.hp > 0 &&
      !occupied.has(human.heroId),
  );
}
