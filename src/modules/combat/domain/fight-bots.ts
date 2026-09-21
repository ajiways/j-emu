import type { FightEffectIds } from "./fight-effect-ids.ts";
import { HuntRosterBot, type HuntRosterBotSeed } from "./hunt-roster-bot.ts";

export function requireFightBots(
  bots: readonly HuntRosterBot[] | null | undefined,
): HuntRosterBot[] {
  if (!Array.isArray(bots)) throw new Error("Battle fight bots are required");
  return [...bots];
}

export function requireFightBot(bots: readonly HuntRosterBot[], fightId: number): HuntRosterBot {
  const bot = bots.find((entry) => entry.fightId === fightId);
  if (!bot) throw new Error(`Fight bot ${fightId} is missing`);
  return bot;
}

/**
 * First enemy-team AI. Seed order puts enemy AIs before opener-team AIs, so
 * this is the start-time primary (`fightSetupTeamAis(setup, enemyTeam)[0]`),
 * not “whatever sits at bots[0]”.
 */
export function primaryEnemyBot(bots: readonly HuntRosterBot[], enemyTeam: 1 | 2): HuntRosterBot {
  const bot = bots.find((entry) => entry.team === enemyTeam);
  if (!bot) throw new Error("Battle is missing the primary enemy bot");
  return bot;
}

export function enqueueAggroClone(
  bots: HuntRosterBot[],
  sourceFightId: number,
  cloneFightId: number,
  enemyTeam: 1 | 2,
): HuntRosterBot {
  const source = requireFightBot(bots, sourceFightId);
  if (source.team !== enemyTeam) {
    throw new Error("Aggro clone source must be an enemy bot");
  }
  const clone = source.cloneWithFightId(cloneFightId);
  if (bots.some((bot) => bot.fightId === clone.fightId)) {
    throw new Error(`Fight bot id ${clone.fightId} collides`);
  }
  bots.push(clone);
  clone.unpair();
  return clone;
}

export function seedFightBots(
  input: Readonly<{
    enemyAis: readonly HuntRosterBotSeed[];
    openerAis: readonly HuntRosterBotSeed[];
    occupiedIds: readonly number[];
    effectIds: FightEffectIds;
    enemyTeam: 1 | 2;
    openerTeam: 1 | 2;
  }>,
): HuntRosterBot[] {
  const seen = new Set<number>(input.occupiedIds);
  const bots: HuntRosterBot[] = [];
  for (const [index, seed] of input.enemyAis.entries()) {
    bots.push(createFightBot(seed, input.enemyTeam, input.effectIds, seen, index > 0));
  }
  for (const seed of input.openerAis) {
    bots.push(createFightBot(seed, input.openerTeam, input.effectIds, seen, true));
  }
  return bots;
}

function createFightBot(
  seed: HuntRosterBotSeed,
  team: 1 | 2,
  effectIds: FightEffectIds,
  seen: Set<number>,
  waiting: boolean,
): HuntRosterBot {
  const bot = HuntRosterBot.fromSeed(seed, team, effectIds);
  if (seen.has(bot.fightId)) {
    throw new Error(`Fight bot id ${bot.fightId} collides`);
  }
  seen.add(bot.fightId);
  if (waiting) bot.unpair();
  return bot;
}
