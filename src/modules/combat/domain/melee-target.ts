import type { Combatant } from "./combatant.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { strikeStatsFromBot, strikeStatsFromHuman } from "./melee-outcome.ts";

export type MeleeTarget =
  | Readonly<{ kind: "human"; human: HumanFighter } & Combatant>
  | Readonly<{ kind: "bot"; bot: BotFighter } & Combatant>;

export function humanMeleeTarget(human: HumanFighter): MeleeTarget {
  return {
    kind: "human",
    human,
    id: human.heroId,
    team: human.team,
    maxHp: human.maxHp,
    mag: human.mag,
    strikeStats: strikeStatsFromHuman(human),
    alive: !human.leftLive && human.hp > 0,
  };
}

export function botMeleeTarget(bot: BotFighter): MeleeTarget {
  return {
    kind: "bot",
    bot,
    id: bot.fightId,
    team: bot.team,
    maxHp: bot.maxHp,
    mag: bot.mag,
    strikeStats: strikeStatsFromBot(bot),
    alive: bot.hp > 0,
  };
}

export function fightCombatants(
  humans: readonly HumanFighter[],
  bots: readonly BotFighter[],
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
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
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
