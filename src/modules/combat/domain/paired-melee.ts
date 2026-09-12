import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { meleeDamageBounds, rollMeleeDamage } from "./melee-damage.ts";
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
  let damage = rollMeleeDamage(attacker.meleeStrength(), input.random, input.rules);
  const orb = attacker.casts.takeOrbPcStr();
  if (orb > 0) damage = Math.max(1, Math.round(damage * (1 + orb / 100)));
  if (attacker.casts.takeGloveCrit()) {
    damage = meleeDamageBounds(attacker.meleeStrength(), input.rules).max;
  }
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const hit = applyDamageToMeleeTarget(attacker, target, damage, {
    humans: input.humans,
    bots: input.bots,
  });
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: attacker.heroId,
      targetId: hit.targetId,
      animation: `attack_${side}`,
      hpChange: -damage,
      targetMaxHp: hit.targetMaxHp,
      killed: hit.killed,
      ...(comboCp !== undefined ? { comboCp } : {}),
    },
  ];
  for (const effectId of attacker.effects.onActorEndingTurn(input.nowMs)) {
    events.push({ type: "effect-purge", effectId });
  }
  if (hit.finished) {
    events.push({ type: "finished", winnerTeam: attacker.team, fightId: input.fightId });
  }
  return { result: { kind: "resolved", events }, hitBot: hit.hitBot, finished: hit.finished };
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
    const applied = Math.min(target.human.hp, damage);
    attacker.creditDamageToHumans(applied);
    const killed = target.human.applyDamage(damage);
    return {
      killed,
      hitBot: null,
      finished: killed && enemySideCleared(target.human.team, context.humans, context.bots),
      targetId: target.human.heroId,
      targetMaxHp: target.human.maxHp,
    };
  }
  const applied = Math.min(target.hp, damage);
  attacker.creditDamageToBot(applied);
  const hitBot: BotMeleePresence = {
    fightId: target.id,
    hp: target.hp - applied,
    maxHp: target.maxHp,
    team: target.team,
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
