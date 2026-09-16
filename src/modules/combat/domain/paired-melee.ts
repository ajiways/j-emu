import { appliedHpLoss } from "./applied-hp-loss.ts";
import { applyCarrierTicks } from "./apply-carrier-ticks.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import {
  rollMeleeOutcome,
  strikeStatsFromHuman,
  unpublishedBotStrikeStats,
} from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import { enemySideCleared, type BotMeleePresence, type MeleeTarget } from "./melee-target.ts";
import type { RandomSource } from "./random-source.ts";

export type PlayerMeleeResult =
  Readonly<{ kind: "ignored" }> | Readonly<{ kind: "resolved"; events: readonly BattleEvent[] }>;

export function tryPairedMelee(
  attacker: HuntHuman,
  target: MeleeTarget,
  side: "left" | "center" | "right",
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    nowMs: number;
  }>,
): Readonly<{
  result: PlayerMeleeResult;
  hitBot: BotMeleePresence | null;
  finished: boolean;
}> {
  if (attacker.waiting || !attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, hitBot: null, finished: input.finished };
  }
  requireLivingMeleeTarget(target);
  attacker.endTurn();
  let baseDamage = rollMeleeDamage(attacker.meleeStrength(), input.random, input.rules);
  const orb = attacker.casts.takeOrbPcStr();
  if (orb > 0) baseDamage = Math.max(1, Math.round(baseDamage * (1 + orb / 100)));
  const outcome = rollMeleeOutcome({
    baseDamage,
    attacker: strikeStatsFromHuman(attacker),
    defender:
      target.kind === "human" ? strikeStatsFromHuman(target.human) : unpublishedBotStrikeStats(1),
    targetHp: target.kind === "human" ? target.human.hp : target.hp,
    forceCrit: attacker.casts.takeGloveCrit(),
    random: input.random,
    rules: input.rules,
  });
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const hit =
    outcome.applied < 1
      ? {
          killed: false,
          hitBot:
            target.kind === "bot"
              ? {
                  fightId: target.id,
                  hp: target.hp,
                  maxHp: target.maxHp,
                  team: target.team,
                  mag: target.mag,
                }
              : null,
          finished: input.finished,
          targetId: target.kind === "human" ? target.human.heroId : target.id,
          targetMaxHp: target.kind === "human" ? target.human.maxHp : target.maxHp,
        }
      : applyDamageToMeleeTarget(attacker, target, outcome.applied, {
          humans: input.humans,
          bots: input.bots,
        });
  const extraHp =
    target.kind === "human" ? target.human.hp : hit.hitBot !== null ? hit.hitBot.hp : target.hp;
  const extra = rollOverlayExtra(
    attacker.casts,
    attacker.mag,
    target.kind === "human" ? target.human.mag : target.mag,
    extraHp,
    input.random,
    input.rules,
  );
  let finished = hit.finished;
  let hitBot = hit.hitBot;
  let killed = hit.killed;
  if (extra) {
    const extraApplied = -extra.hpChange;
    if (target.kind === "human") {
      const extraHit = applyDamageToMeleeTarget(attacker, target, extraApplied, {
        humans: input.humans,
        bots: input.bots,
      });
      finished = extraHit.finished;
      killed = extraHit.killed || hit.killed;
    } else if (hitBot) {
      const remaining = hitBot.hp;
      const applied = appliedHpLoss(extraApplied, remaining);
      attacker.creditDamageToBot(applied);
      const updated: BotMeleePresence = { ...hitBot, hp: remaining - applied };
      hitBot = updated;
      killed = updated.hp === 0 || hit.killed;
      const botsAfter = input.bots.map((bot) => (bot.fightId === updated.fightId ? updated : bot));
      finished = killed && enemySideCleared(target.team, input.humans, botsAfter);
    }
  }
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: attacker.heroId,
      targetId: hit.targetId,
      animation: `attack_${side}`,
      hpChange: -outcome.applied,
      targetMaxHp: hit.targetMaxHp,
      killed,
      react: outcome.react,
      ...(comboCp !== undefined ? { comboCp } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
  ];
  for (const effectId of attacker.effects.onActorEndingTurn(input.nowMs)) {
    events.push({ type: "effect-purge", effectId });
  }
  events.push(...applyCarrierTicks(attacker, input.random, input.rules));
  if (finished) {
    events.push({ type: "finished", winnerTeam: attacker.team, fightId: input.fightId });
  }
  return { result: { kind: "resolved", events }, hitBot, finished };
}

export function applyDamageToMeleeTarget(
  attacker: HuntHuman,
  target: MeleeTarget,
  damage: number,
  context: Readonly<{
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
  }>,
): Readonly<{
  killed: boolean;
  hitBot: BotMeleePresence | null;
  finished: boolean;
  targetId: number;
  targetMaxHp: number;
}> {
  if (!Number.isInteger(damage) || damage < 1) {
    throw new Error("Melee damage must be a positive integer");
  }
  requireLivingMeleeTarget(target);
  if (target.kind === "human") {
    const applied = appliedHpLoss(damage, target.human.hp);
    attacker.creditDamageToHumans(applied);
    const killed = target.human.applyDamage(applied);
    return {
      killed,
      hitBot: null,
      finished: killed && enemySideCleared(target.human.team, context.humans, context.bots),
      targetId: target.human.heroId,
      targetMaxHp: target.human.maxHp,
    };
  }
  const applied = appliedHpLoss(damage, target.hp);
  attacker.creditDamageToBot(applied);
  const hitBot: BotMeleePresence = {
    fightId: target.id,
    hp: target.hp - applied,
    maxHp: target.maxHp,
    team: target.team,
    mag: target.mag,
  };
  const botsAfter = context.bots.map((bot) => (bot.fightId === target.id ? hitBot : bot));
  if (!context.bots.some((bot) => bot.fightId === target.id)) {
    throw new Error(`Melee bot ${target.id} is missing from the roster`);
  }
  const killed = hitBot.hp === 0;
  return {
    killed,
    hitBot,
    finished: killed && enemySideCleared(target.team, context.humans, botsAfter),
    targetId: target.id,
    targetMaxHp: target.maxHp,
  };
}

function requireLivingMeleeTarget(target: MeleeTarget): void {
  if (target.kind === "human") {
    if (target.human.waiting || target.human.hp === 0) {
      throw new Error("Melee target is not a living paired opponent");
    }
    return;
  }
  if (target.hp === 0) {
    throw new Error("Melee target is not a living paired opponent");
  }
}
