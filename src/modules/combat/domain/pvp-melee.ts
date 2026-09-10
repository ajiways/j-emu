import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { meleeDamageBounds, rollMeleeDamage } from "./melee-damage.ts";
import type { RandomSource } from "./random-source.ts";
import type { PlayerMeleeResult } from "./hunt-melee.ts";

export function tryPvpMelee(
  attacker: HuntHuman,
  defender: HuntHuman,
  side: "left" | "center" | "right",
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
  }>,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  if (attacker.waiting || !attacker.turnActive || input.finished) {
    return { result: { kind: "ignored" }, finished: input.finished };
  }
  if (defender.waiting || defender.hp === 0) {
    throw new Error("PvP melee target is not a living paired opponent");
  }
  attacker.endTurn();
  let damage = rollMeleeDamage(attacker.strength, input.random, input.rules);
  const orb = attacker.casts.takeOrbPcStr();
  if (orb > 0) damage = Math.max(1, Math.round(damage * (1 + orb / 100)));
  if (attacker.casts.takeGloveCrit()) {
    damage = meleeDamageBounds(attacker.strength, input.rules).max;
  }
  const comboCp = attacker.casts.hits.length > 0 ? attacker.casts.advanceCombo(side) : undefined;
  const killed = defender.applyDamage(damage);
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: attacker.heroId,
      targetId: defender.heroId,
      animation: `attack_${side}`,
      hpChange: -damage,
      targetMaxHp: defender.maxHp,
      killed,
      ...(comboCp !== undefined ? { comboCp } : {}),
    },
  ];
  if (killed) {
    events.push({ type: "finished", winnerTeam: attacker.team, fightId: input.fightId });
  }
  return { result: { kind: "resolved", events }, finished: killed };
}
