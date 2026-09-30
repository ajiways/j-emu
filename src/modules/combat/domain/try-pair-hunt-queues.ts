import { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { rollOpensFirst } from "./roll-opens-first.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

export type HuntSeeker = Readonly<{
  id: number;
  team: 1 | 2;
  lastOpponentId: number | null;
  initiative: number;
}>;

export function requireDuelContaining(duels: readonly FightDuel[], id: number): FightDuel {
  const duel = duels.find((entry) => entry.has(id));
  if (!duel) throw new Error(`No duel contains participant ${id}`);
  return duel;
}

export function pairHuntHumanQueues(
  humans: readonly HumanFighter[],
  duels: FightDuel[],
  random: RandomSource,
): FightDuel | null {
  return pairHuntQueues({ participants: humans, duels, random });
}

export function pairHuntQueues(
  input: Readonly<{
    participants: readonly Participant[];
    duels: FightDuel[];
    random: RandomSource;
  }>,
): FightDuel | null {
  let created: FightDuel | null = null;
  for (;;) {
    const next = pairOneHuntQueue(input);
    if (!next) return created;
    created = next;
  }
}

/** Whether a living waiting participant of each team is free to be paired. */
export function hasPairableSeekers(
  participants: readonly Participant[],
  duels: readonly FightDuel[],
): boolean {
  const seekers = huntSeekers(participants, occupiedParticipantIds(duels));
  return seekers.some((s) => s.team === 1) && seekers.some((s) => s.team === 2);
}

export function pickHuntPair(
  seekers: readonly HuntSeeker[],
  occupied: ReadonlySet<number>,
  random: RandomSource,
): Readonly<{ aId: number; bId: number }> | null {
  const team1 = seekers.filter((seeker) => seeker.team === 1 && !occupied.has(seeker.id));
  const team2 = seekers.filter((seeker) => seeker.team === 2 && !occupied.has(seeker.id));
  if (team1.length === 0 || team2.length === 0) return null;
  const t1 = [...team1];
  const t2 = [...team2];
  shuffleInPlace(t1, random);
  shuffleInPlace(t2, random);
  let bestA = t1[0];
  let bestB = t2[0];
  if (!bestA || !bestB) return null;
  let best = -1;
  for (const x of t1) {
    for (const y of t2) {
      let score = 0;
      if (x.lastOpponentId !== y.id) score += 2;
      if (y.lastOpponentId !== x.id) score += 1;
      if (score > best) {
        best = score;
        bestA = x;
        bestB = y;
      }
    }
  }
  return { aId: bestA.id, bId: bestB.id };
}

export function dissolveDuelContaining(
  duels: FightDuel[],
  participants: readonly Participant[],
  participantId: number,
): void {
  const index = duels.findIndex((duel) => duel.has(participantId));
  if (index < 0) return;
  dissolveDuelAt(duels, index, participants, participantId);
}

export function dissolveDuelAt(
  duels: FightDuel[],
  index: number,
  participants: readonly Participant[],
  keepFightId: number | null,
): void {
  const duel = duels[index];
  if (!duel) throw new Error("Battle duel slot is empty");
  duels.splice(index, 1);
  for (const id of [duel.aId, duel.bId]) {
    if (id === keepFightId) continue;
    releaseSeeker(participants, id);
  }
}

function pairOneHuntQueue(
  input: Readonly<{
    participants: readonly Participant[];
    duels: FightDuel[];
    random: RandomSource;
  }>,
): FightDuel | null {
  const occupied = occupiedParticipantIds(input.duels);
  const seekers = huntSeekers(input.participants, occupied);
  const picked = pickHuntPair(seekers, occupied, input.random);
  if (!picked) return null;
  if (occupied.has(picked.aId) || occupied.has(picked.bId)) {
    throw new Error(`Hunt pair collides with occupied id ${picked.aId}/${picked.bId}`);
  }
  const a = requireSeeker(seekers, picked.aId);
  const b = requireSeeker(seekers, picked.bId);
  const team1 = a.team === 1 ? a : b;
  const team2 = a.team === 1 ? b : a;
  const openerId = rollOpensFirst(team1.initiative, team2.initiative, input.random)
    ? team1.id
    : team2.id;
  pairSeeker(input.participants, a);
  pairSeeker(input.participants, b);
  const duel = new FightDuel(a.id, b.id, openerId);
  input.duels.push(duel);
  return duel;
}

function huntSeekers(
  participants: readonly Participant[],
  occupied: ReadonlySet<number>,
): HuntSeeker[] {
  return participants
    .filter((member) => member.alive && member.waiting && !occupied.has(member.id))
    .map((member) => ({
      id: member.id,
      team: member.team,
      lastOpponentId: member.lastOpponentId,
      initiative: member.currentInitiative,
    }));
}

function occupiedParticipantIds(duels: readonly FightDuel[]): Set<number> {
  const occupied = new Set<number>();
  for (const duel of duels) {
    occupied.add(duel.aId);
    occupied.add(duel.bId);
  }
  return occupied;
}

function pairSeeker(participants: readonly Participant[], seeker: HuntSeeker): void {
  requireParticipant(participants, seeker.id, "Hunt seeker").pair();
}

function releaseSeeker(participants: readonly Participant[], id: number): void {
  const member = requireParticipant(participants, id, "Duel participant");
  if (!member.waiting && member.alive) member.unpair();
}

function requireParticipant(
  participants: readonly Participant[],
  id: number,
  label: string,
): Participant {
  const member = participants.find((entry) => entry.id === id);
  if (!member) throw new Error(`${label} ${id} is missing`);
  return member;
}

function requireSeeker(seekers: readonly HuntSeeker[], id: number): HuntSeeker {
  const seeker = seekers.find((entry) => entry.id === id);
  if (!seeker) throw new Error(`Hunt seeker ${id} is missing`);
  return seeker;
}
