import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";

export type BotMeleePresence = Readonly<{
  fightId: number;
  hp: number;
  maxHp: number;
  team: 1 | 2;
}>;

export type MeleeTarget =
  | Readonly<{ kind: "human"; human: HuntHuman }>
  | Readonly<{
      kind: "bot";
      id: number;
      team: 1 | 2;
      hp: number;
      maxHp: number;
    }>;

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
  if (human) return { kind: "human", human };
  const bot = input.bots.find((entry) => entry.fightId === otherId);
  if (bot) {
    return {
      kind: "bot",
      id: bot.fightId,
      team: bot.team,
      hp: bot.hp,
      maxHp: bot.maxHp,
    };
  }
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
