import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { DuelPairing } from "./battle-pairing.ts";
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

export function duelPairingOf(
  duel: FightDuel,
  humans: HumanFighter[],
  pairedAccountId: number,
): DuelPairing {
  return { duel, humans, pairedAccountId };
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
