import type { FightDuel } from "./fight-duel.ts";
import { isHumanDuelInit } from "./battle-fighters.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { HuntPairing } from "./battle-pairing.ts";
import { resolveMeleeTarget, type BotMeleePresence, type MeleeTarget } from "./melee-target.ts";

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

export function huntRosterBots(roster: HuntRoster | null): readonly BotMeleePresence[] {
  return roster ? roster.presences() : [];
}

export function huntPairingOf(
  duel: FightDuel,
  humans: HuntHuman[],
  pairedAccountId: number,
): HuntPairing {
  return { duel, humans, pairedAccountId };
}

export function resolveBattleMeleeTarget(
  attacker: HuntHuman,
  duel: FightDuel,
  humans: readonly HuntHuman[],
  bots: readonly BotMeleePresence[],
): MeleeTarget {
  return resolveMeleeTarget({
    attackerHeroId: attacker.heroId,
    duel,
    humans,
    bots,
  });
}
