import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { HuntPairing } from "./battle-pairing.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { resolveMeleeTarget, type MeleeTarget } from "./melee-target.ts";
import { requireDuelContaining } from "./try-pair-hunt-queues.ts";

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

export function huntPairingOf(
  duel: FightDuel,
  humans: HumanFighter[],
  pairedAccountId: number,
): HuntPairing {
  return { duel, humans, pairedAccountId };
}

function resolveBattleMeleeTarget(
  attacker: HumanFighter,
  duel: FightDuel,
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
): MeleeTarget {
  return resolveMeleeTarget({
    attackerHeroId: attacker.heroId,
    duel,
    humans,
    bots,
  });
}

export function battlePairedOpponent(
  humans: readonly HumanFighter[],
  duels: readonly FightDuel[],
  bots: readonly BotFighter[],
  accountId: number,
): Readonly<{ kind: "human"; accountId: number } | { kind: "bot" }> {
  const human = requireBattleHuman(humans, accountId);
  const target = resolveBattleMeleeTarget(
    human,
    requireDuelContaining(duels, human.heroId),
    humans,
    bots,
  );
  if (target.kind === "bot") return { kind: "bot" };
  return { kind: "human", accountId: target.human.accountId };
}
