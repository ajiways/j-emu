import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { consumeOverlayCharge } from "./consume-overlay-charge.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import {
  rollMeleeOutcome,
  strikeStatsFromHuman,
  unpublishedBotStrikeStats,
} from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
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
    bot: HuntRosterBot;
    fightId: string;
    keepFightOnKill: boolean;
    winnerTeam: 1 | 2;
  }>,
): BotMeleeResult {
  if (human.waiting || human.hp === 0) {
    throw new Error("Paired hunter is not a bot melee target");
  }
  const baseDamage = rollMeleeDamage(input.bot.strength, input.random, input.rules);
  const outcome = rollMeleeOutcome({
    baseDamage,
    attacker: unpublishedBotStrikeStats(input.bot.strength),
    defender: strikeStatsFromHuman(human),
    targetHp: human.hp,
    forceCrit: false,
    random: input.random,
    rules: input.rules,
  });
  const killedPlayer = outcome.applied < 1 ? false : human.applyDamage(outcome.applied);
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
    overlayKilled = human.applyDamage(-extra.hpChange);
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
  human: HuntHuman,
  timeoutSeconds: number,
  nowMs: number,
): BattleEvent | null {
  if (human.stunnedTurns > 0) {
    human.stunnedTurns -= 1;
    return null;
  }
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn(nowMs, timeoutSeconds);
  return { type: "turn-granted", timeoutSeconds };
}
