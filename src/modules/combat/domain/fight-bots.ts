import type { FightRules } from "./fight-rules.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import { BotFighter, type BotFighterSeed } from "./bot-fighter.ts";

export function requireFightBots(bots: readonly BotFighter[] | null | undefined): BotFighter[] {
  if (!Array.isArray(bots)) throw new Error("Battle fight bots are required");
  return [...bots];
}

export function requireFightBot(bots: readonly BotFighter[], fightId: number): BotFighter {
  const bot = bots.find((entry) => entry.fightId === fightId);
  if (!bot) throw new Error(`Fight bot ${fightId} is missing`);
  return bot;
}

/**
 * First enemy-team AI. Seed order puts enemy AIs before opener-team AIs, so
 * this is the start-time primary (`fightSetupTeamAis(setup, enemyTeam)[0]`),
 * not “whatever sits at bots[0]”.
 */
export function primaryEnemyBot(bots: readonly BotFighter[], enemyTeam: 1 | 2): BotFighter {
  const bot = bots.find((entry) => entry.team === enemyTeam);
  if (!bot) throw new Error("Battle is missing the primary enemy bot");
  return bot;
}

export function enqueueAggroClone(
  bots: readonly BotFighter[],
  sourceFightId: number,
  cloneFightId: number,
  enemyTeam: 1 | 2,
  add: (bot: BotFighter) => void,
): BotFighter {
  const source = requireFightBot(bots, sourceFightId);
  if (source.team !== enemyTeam) {
    throw new Error("Aggro clone source must be an enemy bot");
  }
  const clone = source.cloneWithFightId(cloneFightId);
  if (bots.some((bot) => bot.fightId === clone.fightId)) {
    throw new Error(`Fight bot id ${clone.fightId} collides`);
  }
  add(clone);
  clone.unpair();
  return clone;
}

export function seedFightBots(
  input: Readonly<{
    enemyAis: readonly BotFighterSeed[];
    openerAis: readonly BotFighterSeed[];
    occupiedIds: readonly number[];
    effectIds: FightEffectIds;
    enemyTeam: 1 | 2;
    openerTeam: 1 | 2;
    /** The primary enemy starts without a foe (the player waits instead). */
    primaryWaits: boolean;
  }>,
): BotFighter[] {
  const seen = new Set<number>(input.occupiedIds);
  const bots: BotFighter[] = [];
  for (const [index, seed] of input.enemyAis.entries()) {
    bots.push(
      createFightBot(seed, input.enemyTeam, input.effectIds, seen, index > 0 || input.primaryWaits),
    );
  }
  for (const seed of input.openerAis) {
    bots.push(createFightBot(seed, input.openerTeam, input.effectIds, seen, true));
  }
  return bots;
}

function createFightBot(
  seed: BotFighterSeed,
  team: 1 | 2,
  effectIds: FightEffectIds,
  seen: Set<number>,
  waiting: boolean,
): BotFighter {
  const bot = BotFighter.fromSeed(seed, team, effectIds);
  if (seen.has(bot.fightId)) {
    throw new Error(`Fight bot id ${bot.fightId} collides`);
  }
  seen.add(bot.fightId);
  if (waiting) bot.unpair();
  return bot;
}

/** A fight against mobs is titled by its first one; a duel of players stays titled by the players. */
export function titledByBot(bots: readonly BotFighter[], rules: FightRules): boolean {
  return (
    rules.historyRow !== "practice-humans" &&
    bots.some((bot) => bot.team === rules.teamAssignment.enemyTeam)
  );
}
