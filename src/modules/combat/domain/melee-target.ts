import type { FightDuel } from "./fight-duel.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
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

export function huntBotMeleePresence(hunt: HuntBattleInit, hp: number): BotMeleePresence {
  if (!Number.isInteger(hp) || hp < 0) {
    throw new Error("Hunt bot HP must be a non-negative integer");
  }
  return {
    fightId: hunt.botFightId,
    hp,
    maxHp: hunt.botMaxHp,
    team: 2,
  };
}

export function resolveMeleeTarget(
  input: Readonly<{
    attackerHeroId: number;
    duel: FightDuel;
    humans: readonly HuntHuman[];
    bot: BotMeleePresence | null;
  }>,
): MeleeTarget {
  const otherId = input.duel.otherId(input.attackerHeroId);
  const human = input.humans.find((entry) => entry.heroId === otherId);
  if (human) return { kind: "human", human };
  if (input.bot !== null && otherId === input.bot.fightId) {
    return {
      kind: "bot",
      id: input.bot.fightId,
      team: input.bot.team,
      hp: input.bot.hp,
      maxHp: input.bot.maxHp,
    };
  }
  throw new Error(`Duel opponent ${otherId} is neither a human nor the hunt bot`);
}

export function enemySideCleared(
  team: 1 | 2,
  humans: readonly HuntHuman[],
  bot: BotMeleePresence | null,
): boolean {
  const livingHuman = humans.some(
    (human) => human.team === team && !human.leftLive && human.hp > 0,
  );
  if (livingHuman) return false;
  return bot === null || bot.team !== team || bot.hp === 0;
}
