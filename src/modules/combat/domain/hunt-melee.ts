import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import type { RandomSource } from "./random-source.ts";

export type BotMeleeResult = Readonly<{
  events: readonly BattleEvent[];
  killedPlayer: boolean;
}>;

export function resolveBotMelee(
  human: HuntHuman,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    botFightId: number;
    botStrength: number;
    fightId: string;
    keepFightOnKill: boolean;
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult {
  if (human.waiting || human.hp === 0) {
    throw new Error("Paired hunter is not a bot melee target");
  }
  const botDamage = rollMeleeDamage(input.botStrength, input.random, input.rules);
  const killedPlayer = human.applyDamage(botDamage);
  const dRage = human.casts.awardIncomingRage(botDamage, human.maxHp);
  const events: BattleEvent[] = [
    {
      type: "damage",
      sourceId: input.botFightId,
      targetId: human.heroId,
      animation: "attack_center",
      hpChange: -botDamage,
      targetMaxHp: human.maxHp,
      killed: killedPlayer,
      dRage,
    },
  ];
  if (killedPlayer && !input.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: input.winnerTeam, fightId: input.fightId });
  }
  return { events, killedPlayer };
}

export function grantTurn(
  human: HuntHuman,
  timeoutSeconds: number,
  nowMs: number,
): BattleEvent | null {
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn(nowMs, timeoutSeconds);
  return { type: "turn-granted", timeoutSeconds };
}
