import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { duelFoe } from "./melee-target.ts";
import { requireDuelContaining } from "./pairing.ts";

export function requireBattleHuman(
  humans: readonly HumanFighter[],
  accountId: number,
): HumanFighter {
  const human = humans.find((entry) => entry.accountId === accountId);
  if (!human) throw new Error(`Human account ${accountId} is not in this battle`);
  return human;
}

export function requireAuthedHuman(
  humans: readonly HumanFighter[],
  accountId: number,
): HumanFighter {
  const human = requireBattleHuman(humans, accountId);
  if (!human.authed) throw new Error("Fight session is not authenticated");
  return human;
}

export function battleOpener(humans: readonly HumanFighter[]): HumanFighter {
  const human = humans[0];
  if (!human) throw new Error("Battle has no humans");
  return human;
}

export function battlePairedOpponent(
  humans: readonly HumanFighter[],
  duels: readonly FightDuel[],
  bots: readonly BotFighter[],
  accountId: number,
): Readonly<{ kind: "human"; accountId: number } | { kind: "bot" }> {
  const human = requireBattleHuman(humans, accountId);
  const foe = duelFoe(requireDuelContaining(duels, human.heroId), [...humans, ...bots], human.id);
  if (foe.fighterKind === "bot") return { kind: "bot" };
  return { kind: "human", accountId: (foe as HumanFighter).accountId };
}

/**
 * Whether the fight can go on after `accountId` leaves: another player is still in it, or someone
 * of his own team is still standing (an ally mob). Otherwise his leaving ends it.
 */
export function fightContinuesWithout(
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
  accountId: number,
): boolean {
  const leaver = requireBattleHuman(humans, accountId);
  const others = [...humans, ...bots].filter((entry) => entry.id !== leaver.id);
  return others.some(
    (entry) => entry.alive && (entry.fighterKind === "human" || entry.team === leaver.team),
  );
}
