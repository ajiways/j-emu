import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { RandomSource } from "./random-source.ts";

export type PlayerMeleeResult =
  Readonly<{ kind: "ignored" }> | Readonly<{ kind: "resolved"; events: readonly BattleEvent[] }>;

export type BotMeleeResult = Readonly<{
  events: readonly BattleEvent[];
  killedPlayer: boolean;
}>;

export function tryPlayerMelee(
  human: HuntHuman,
  side: "left" | "center" | "right",
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    botHp: number;
    botFightId: number;
    botMaxHp: number;
    fightId: string;
  }>,
): Readonly<{ result: PlayerMeleeResult; botHp: number; finished: boolean }> {
  if (human.waiting || !human.turnActive || input.finished) {
    return { result: { kind: "ignored" }, botHp: input.botHp, finished: input.finished };
  }
  human.endTurn();
  const playerDamage = input.random.integer(
    input.rules.playerDamageMin,
    input.rules.playerDamageMax,
  );
  const botHp = Math.max(0, input.botHp - playerDamage);
  const killed = botHp === 0;
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: human.heroId,
      targetId: input.botFightId,
      animation: `attack_${side}`,
      hpChange: -playerDamage,
      targetMaxHp: input.botMaxHp,
      killed,
    },
  ];
  if (killed) {
    events.push({ type: "finished", winnerTeam: 1, fightId: input.fightId });
  }
  return { result: { kind: "resolved", events }, botHp, finished: killed };
}

export function resolveBotMelee(
  human: HuntHuman,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    botFightId: number;
    fightId: string;
    hasWaiter: boolean;
  }>,
): BotMeleeResult {
  if (human.waiting || human.hp === 0) {
    throw new Error("Paired hunter is not a bot melee target");
  }
  const botDamage = input.random.integer(input.rules.botDamageMin, input.rules.botDamageMax);
  const killedPlayer = human.applyDamage(botDamage);
  const events: BattleEvent[] = [
    {
      type: "damage",
      sourceId: input.botFightId,
      targetId: human.heroId,
      animation: "attack_center",
      hpChange: -botDamage,
      targetMaxHp: human.maxHp,
      killed: killedPlayer,
    },
  ];
  if (killedPlayer && !input.hasWaiter) {
    events.push({ type: "finished", winnerTeam: 2, fightId: input.fightId });
  }
  return { events, killedPlayer };
}

export function grantTurn(human: HuntHuman, timeoutSeconds: number): BattleEvent | null {
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn();
  return { type: "turn-granted", timeoutSeconds };
}
