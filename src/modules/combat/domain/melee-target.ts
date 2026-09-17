import type { Combatant } from "./combatant.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { MagStats } from "./mag-stats.ts";
import { strikeStatsFromHuman, unpublishedBotStrikeStats } from "./melee-outcome.ts";

export type BotMeleePresence = Readonly<{
  fightId: number;
  hp: number;
  maxHp: number;
  team: 1 | 2;
  strength: number;
  mag: MagStats;
}>;

export type MeleeTarget =
  | Readonly<{ kind: "human"; human: HuntHuman } & Combatant>
  | Readonly<{ kind: "bot"; presence: BotMeleePresence } & Combatant>;

export function humanMeleeTarget(human: HuntHuman): MeleeTarget {
  return {
    kind: "human",
    human,
    id: human.heroId,
    team: human.team,
    maxHp: human.maxHp,
    mag: human.mag,
    strikeStats: strikeStatsFromHuman(human),
  };
}

export function botMeleeTarget(presence: BotMeleePresence): MeleeTarget {
  return {
    kind: "bot",
    presence,
    id: presence.fightId,
    team: presence.team,
    maxHp: presence.maxHp,
    mag: presence.mag,
    strikeStats: unpublishedBotStrikeStats(presence.strength),
  };
}

export function targetHp(target: MeleeTarget): number {
  return target.kind === "human" ? target.human.hp : target.presence.hp;
}

export function resolveMeleeTarget(
  input: Readonly<{
    attackerHeroId: number;
    duel: FightDuel;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
  }>,
): MeleeTarget {
  const otherId = input.duel.otherId(input.attackerHeroId);
  const human = input.humans.find((entry) => entry.heroId === otherId);
  if (human) return humanMeleeTarget(human);
  const bot = input.bots.find((entry) => entry.fightId === otherId);
  if (bot) return botMeleeTarget(bot);
  throw new Error(`Duel opponent ${otherId} is neither a human nor a fight bot`);
}

export function enemySideCleared(
  team: 1 | 2,
  humans: readonly HuntHuman[],
  bots: readonly BotMeleePresence[],
): boolean {
  const livingHuman = humans.some(
    (human) => human.team === team && !human.leftLive && human.hp > 0,
  );
  if (livingHuman) return false;
  return !bots.some((bot) => bot.team === team && bot.hp > 0);
}
