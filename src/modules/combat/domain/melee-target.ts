import type { Combatant } from "./combatant.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { strikeStatsFromHuman, unpublishedBotStrikeStats } from "./melee-outcome.ts";

export type MeleeTarget =
  | Readonly<{ kind: "human"; human: HuntHuman } & Combatant>
  | Readonly<{ kind: "bot"; bot: HuntRosterBot } & Combatant>;

export function humanMeleeTarget(human: HuntHuman): MeleeTarget {
  return {
    kind: "human",
    human,
    id: human.heroId,
    team: human.team,
    hp: human.hp,
    maxHp: human.maxHp,
    mag: human.mag,
    strikeStats: strikeStatsFromHuman(human),
    alive: !human.leftLive && human.hp > 0,
  };
}

export function botMeleeTarget(bot: HuntRosterBot): MeleeTarget {
  return {
    kind: "bot",
    bot,
    id: bot.fightId,
    team: bot.team,
    hp: bot.hp,
    maxHp: bot.maxHp,
    mag: bot.mag,
    strikeStats: unpublishedBotStrikeStats(bot.strength),
    alive: bot.hp > 0,
  };
}

export function fightCombatants(
  humans: readonly HuntHuman[],
  bots: readonly HuntRosterBot[],
): readonly Combatant[] {
  return [...humans.map(humanMeleeTarget), ...bots.map(botMeleeTarget)];
}

export function targetHp(target: MeleeTarget): number {
  return target.kind === "human" ? target.human.hp : target.bot.hp;
}

export function resolveMeleeTarget(
  input: Readonly<{
    attackerHeroId: number;
    duel: FightDuel;
    humans: readonly HuntHuman[];
    bots: readonly HuntRosterBot[];
  }>,
): MeleeTarget {
  const otherId = input.duel.otherId(input.attackerHeroId);
  const human = input.humans.find((entry) => entry.heroId === otherId);
  if (human) return humanMeleeTarget(human);
  const bot = input.bots.find((entry) => entry.fightId === otherId);
  if (bot) return botMeleeTarget(bot);
  throw new Error(`Duel opponent ${otherId} is neither a human nor a fight bot`);
}

export function enemySideCleared(team: 1 | 2, combatants: readonly Combatant[]): boolean {
  return !combatants.some((entry) => entry.team === team && entry.alive);
}
