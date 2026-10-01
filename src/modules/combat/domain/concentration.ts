import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import { MELEE_REACT } from "./melee-outcome.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import type { Roster } from "./roster.ts";
import { settleFallen, type Fallout } from "./settle-fallen.ts";

export type ConcentrationResult = Readonly<{
  /** The strike as the one who made it sees it, the fresh hit points, and the end of the fight. */
  events: readonly BattleEvent[];
  fallout: Fallout;
}>;

/**
 * «Концентрация» (the native «Удар в спину», `srcId 5`): a participant who stands without a foe
 * deals a little damage to a random living enemy, on a cooldown. The damage is counted as his
 * own for the experience and the heroism of the fight. `null` while it cannot be used.
 */
export function concentrate(
  input: Readonly<{
    actor: Participant;
    roster: Roster;
    duels: FightDuel[];
    fightRules: FightRules;
    fightId: string;
    rules: BattleRules;
    random: RandomSource;
    nowMs: number;
  }>,
): ConcentrationResult | null {
  const { actor, rules } = input;
  if (!actor.alive || !actor.waiting) return null;
  if (actor.casts.concentrationLeftMs(rules.concentrationCooldownSeconds, input.nowMs) > 0) {
    return null;
  }
  const foes = input.roster.all().filter((entry) => entry.team !== actor.team && entry.alive);
  if (foes.length === 0) return null;
  const victim = foes[Math.min(foes.length - 1, Math.floor(input.random.unit() * foes.length))];
  if (!victim) throw new Error("Concentration found no victim");
  const damage =
    1 +
    Math.min(
      rules.concentrationMaxDamage - 1,
      Math.floor(input.random.unit() * rules.concentrationMaxDamage),
    );
  const { applied, killed } = resolveHpLoss(victim, damage, actor);
  actor.casts.noteConcentration(input.nowMs);
  const patch = persChangeForParticipants(
    input.roster.humans,
    input.roster.bots.map((bot) => bot.snap()),
    [actor.id, victim.id],
  );
  const hit: BattleEvent = {
    type: "damage",
    sourceId: actor.id,
    targetId: victim.id,
    animation: "magic_backstab",
    hpChange: -applied,
    targetMaxHp: victim.maxHp,
    killed,
    react: killed ? MELEE_REACT.kill : MELEE_REACT.hit,
  };
  const fallout = killed
    ? settleFallen([victim], input)
    : { deliveries: [], finished: null, fallenAccountIds: [], reassignedAccountIds: [] };
  return { events: [hit, patch, ...(fallout.finished ? [fallout.finished] : [])], fallout };
}
