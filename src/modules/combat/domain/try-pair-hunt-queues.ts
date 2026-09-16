import { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { RandomSource } from "./random-source.ts";
import { rollOpensFirst } from "./roll-opens-first.ts";
import { shuffleInPlace } from "./shuffle-in-place.ts";

export type HuntSeeker = Readonly<{
  id: number;
  team: 1 | 2;
  lastOpponentId: number | null;
  initiative: number;
  kind: "human" | "bot";
}>;

export function requireDuelContaining(duels: readonly FightDuel[], id: number): FightDuel {
  const duel = duels.find((entry) => entry.has(id));
  if (!duel) throw new Error(`No duel contains participant ${id}`);
  return duel;
}

export function pairHuntHumanQueues(
  humans: readonly HuntHuman[],
  duels: FightDuel[],
  random: RandomSource,
): FightDuel | null {
  return pairHuntQueues({ humans, duels, roster: null, random });
}

export function pairHuntQueues(
  input: Readonly<{
    humans: readonly HuntHuman[];
    duels: FightDuel[];
    roster: HuntRoster | null;
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

function pairOneHuntQueue(
  input: Readonly<{
    humans: readonly HuntHuman[];
    duels: FightDuel[];
    roster: HuntRoster | null;
    random: RandomSource;
  }>,
): FightDuel | null {
  const occupied = occupiedParticipantIds(input.duels, input.roster);
  const seekers = huntSeekers(input.humans, input.roster, occupied);
  const picked = pickHuntPair(seekers, occupied, input.random);
  if (!picked) return null;
  const a = requireSeeker(seekers, picked.aId);
  const b = requireSeeker(seekers, picked.bId);
  const team1 = a.team === 1 ? a : b;
  const team2 = a.team === 1 ? b : a;
  const openerId = rollOpensFirst(team1.initiative, team2.initiative, input.random)
    ? team1.id
    : team2.id;
  pairSeeker(input.humans, a);
  pairSeeker(input.humans, b);
  occupyPairedBots(input.roster, a, b);
  if (a.kind === "bot" && b.kind === "bot") {
    if (!input.roster) throw new Error("Bot-bot pairing requires a hunt roster");
    input.roster.addExtraDuel(new FightDuel(a.id, b.id, openerId));
    return null;
  }
  const duel = new FightDuel(a.id, b.id, openerId);
  input.duels.push(duel);
  return duel;
}

function occupyPairedBots(roster: HuntRoster | null, a: HuntSeeker, b: HuntSeeker): void {
  if (a.kind !== "bot" && b.kind !== "bot") return;
  if (!roster) throw new Error("Bot pairing requires a hunt roster");
  if (a.kind === "bot") roster.occupy(a.id);
  if (b.kind === "bot") roster.occupy(b.id);
}

function huntSeekers(
  humans: readonly HuntHuman[],
  roster: HuntRoster | null,
  occupied: ReadonlySet<number>,
): HuntSeeker[] {
  const seekers: HuntSeeker[] = [];
  for (const human of humans) {
    if (human.leftLive || human.hp <= 0 || occupied.has(human.heroId)) continue;
    if (!human.waiting) continue;
    seekers.push({
      id: human.heroId,
      team: human.team,
      lastOpponentId: human.lastOpponentId,
      initiative: human.initiative,
      kind: "human",
    });
  }
  if (!roster) return seekers;
  for (const bot of roster.unpairedLiving(occupied)) {
    seekers.push({
      id: bot.fightId,
      team: bot.team,
      lastOpponentId: bot.lastOpponentId,
      initiative: bot.initiative,
      kind: "bot",
    });
  }
  return seekers;
}

function occupiedParticipantIds(
  duels: readonly FightDuel[],
  roster: HuntRoster | null,
): Set<number> {
  const occupied = new Set<number>();
  for (const duel of duels) {
    occupied.add(duel.aId);
    occupied.add(duel.bId);
  }
  if (roster) {
    for (const id of roster.extraDuelParticipantIds()) occupied.add(id);
  }
  return occupied;
}

function pairSeeker(humans: readonly HuntHuman[], seeker: HuntSeeker): void {
  if (seeker.kind !== "human") return;
  const human = humans.find((entry) => entry.heroId === seeker.id);
  if (!human) throw new Error(`Hunt seeker ${seeker.id} is missing`);
  human.pair();
}

function requireSeeker(seekers: readonly HuntSeeker[], id: number): HuntSeeker {
  const seeker = seekers.find((entry) => entry.id === id);
  if (!seeker) throw new Error(`Hunt seeker ${id} is missing`);
  return seeker;
}
