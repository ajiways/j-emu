import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { consumeOverlayCharge } from "./consume-overlay-charge.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import { rollMeleeOutcome, strikeStatsFromHuman, strikeStatsFromBot } from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

export type BotMeleeResult = Readonly<{
  events: readonly BattleEvent[];
  killedPlayer: boolean;
}>;

export function resolveBotMelee(
  human: HumanFighter,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    bot: BotFighter;
    fightId: string;
    keepFightOnKill: boolean;
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult {
  if (human.waiting || human.hp === 0) {
    throw new Error("Paired hunter is not a bot melee target");
  }
  const baseDamage = rollMeleeDamage(input.bot.meleeStrength(), input.random, input.rules);
  const outcome = rollMeleeOutcome({
    baseDamage,
    attacker: strikeStatsFromBot(input.bot),
    defender: strikeStatsFromHuman(human),
    targetHp: human.hp,
    forceCrit: false,
    random: input.random,
    rules: input.rules,
  });
  const killedPlayer = resolveHpLoss(human, outcome.applied).killed;
  const overlayBefore = input.bot.schoolOverlay;
  const extra = rollOverlayExtra(
    input.bot,
    input.bot.mag,
    human.mag,
    human.hp,
    input.random,
    input.rules,
  );
  let overlayKilled = false;
  if (extra) {
    overlayKilled = resolveHpLoss(human, -extra.hpChange).killed;
  }
  const totalApplied = outcome.applied + (extra ? -extra.hpChange : 0);
  input.bot.creditDealtDamage(totalApplied);
  const dRage = totalApplied < 1 ? 0 : human.casts.awardIncomingRage(totalApplied, human.maxHp);
  const dead = killedPlayer || overlayKilled;
  const events: BattleEvent[] = [
    {
      type: "damage",
      sourceId: input.bot.fightId,
      targetId: human.heroId,
      animation: "attack_center",
      hpChange: -outcome.applied,
      targetMaxHp: human.maxHp,
      killed: dead,
      react: outcome.react,
      dRage,
      ...(extra ? { extraHits: [extra] } : {}),
    },
    ...consumeOverlayCharge(input.bot, overlayBefore),
  ];
  if (dead && !input.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: input.winnerTeam, fightId: input.fightId });
  }
  return { events, killedPlayer: dead };
}

export function grantTurn(
  human: HumanFighter,
  timeoutSeconds: number,
  nowMs: number,
): BattleEvent | null {
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn(nowMs, timeoutSeconds);
  return { type: "turn-granted", timeoutSeconds };
}
