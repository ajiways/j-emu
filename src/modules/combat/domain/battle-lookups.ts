import type { FightDuel } from "./fight-duel.ts";
import { isHumanDuelInit } from "./battle-fighters.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { HuntPairing } from "./battle-pairing.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { resolveMeleeTarget, type MeleeTarget } from "./melee-target.ts";
import { requireDuelContaining } from "./try-pair-hunt-queues.ts";

export function requireBattleHuman(humans: readonly HuntHuman[], accountId: number): HuntHuman {
  const human = humans.find((entry) => entry.accountId === accountId);
  if (!human) throw new Error(`Human account ${accountId} is not in this battle`);
  return human;
}

export function requireAuthedHuman(humans: readonly HuntHuman[], accountId: number): HuntHuman {
  const human = requireBattleHuman(humans, accountId);
  if (!human.authed) throw new Error("Fight session is not authenticated");
  return human;
}

export function requireHuntInit(init: HuntBattleInit | FriendlyDuelBattleInit): HuntBattleInit {
  if (isHumanDuelInit(init)) throw new Error("Human duel has no hunt bot");
  return init;
}

export function requireBattleHuntRoster(roster: HuntRoster | null): HuntRoster {
  if (!roster) throw new Error("Battle has no hunt roster");
  return roster;
}

export function battleOpener(humans: readonly HuntHuman[]): HuntHuman {
  const human = humans[0];
  if (!human) throw new Error("Battle has no humans");
  return human;
}

export function huntRosterBots(roster: HuntRoster | null): readonly HuntRosterBot[] {
  return roster ? roster.allBots() : [];
}

export function huntPairingOf(
  duel: FightDuel,
  humans: HuntHuman[],
  pairedAccountId: number,
): HuntPairing {
  return { duel, humans, pairedAccountId };
}

function resolveBattleMeleeTarget(
  attacker: HuntHuman,
  duel: FightDuel,
  humans: readonly HuntHuman[],
  bots: readonly HuntRosterBot[],
): MeleeTarget {
  return resolveMeleeTarget({
    attackerHeroId: attacker.heroId,
    duel,
    humans,
    bots,
  });
}

export function battlePairedOpponent(
  humans: readonly HuntHuman[],
  duels: readonly FightDuel[],
  huntRoster: HuntRoster | null,
  accountId: number,
): Readonly<{ kind: "human"; accountId: number } | { kind: "bot" }> {
  const human = requireBattleHuman(humans, accountId);
  const target = resolveBattleMeleeTarget(
    human,
    requireDuelContaining(duels, human.heroId),
    humans,
    huntRosterBots(huntRoster),
  );
  if (target.kind === "bot") return { kind: "bot" };
  return { kind: "human", accountId: target.human.accountId };
}
