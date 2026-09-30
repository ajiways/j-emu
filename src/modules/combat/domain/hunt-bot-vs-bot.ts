import { spendStunTurn } from "./apply-stun.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { actBotSpellCard } from "./bot-spell-act.ts";
import { botSpellEndsTurn } from "./bot-spell-damage.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { rollMeleeOutcome, strikeStatsFromBot } from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import { rollSwing } from "./swing.ts";
import { snapshotForBot } from "./combat-snapshot.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

export function resolveRosterBotTurn(
  actor: BotFighter,
  target: BotFighter,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  if (actor.hp === 0) throw new Error("Roster bot actor is dead");
  if (target.hp === 0) throw new Error("Roster bot target is dead");
  if (actor.stunnedTurns > 0) {
    return spendStunTurn(actor);
  }
  const decision = actor.brain.decide(snapshotForBot(actor, target), input.random);
  if (decision.kind === "melee") return [...meleeHit(actor, target, input)];
  const card = decision.card;
  const events = [
    ...actBotSpellCard(actor, target, card, {
      rules: input.rules,
      random: input.random,
      fightId: "roster",
      keepFightOnKill: true,
      living: [],
      winnerTeam: 1,
      nowMs: input.nowMs,
    }),
  ];
  if (target.hp > 0 && (kind1OverlayCharges(card.spell) > 0 || !botSpellEndsTurn(card.spell))) {
    events.push(...meleeHit(actor, target, input));
  }
  return events;
}

function meleeHit(
  actor: BotFighter,
  target: BotFighter,
  input: Readonly<{ rules: BattleRules; random: RandomSource }>,
): readonly BattleEvent[] {
  const swing = rollSwing(actor.effects, actor.meleeStrength(), input.random, input.rules);
  const outcome = rollMeleeOutcome({
    baseDamage: swing.baseDamage,
    attacker: strikeStatsFromBot(actor),
    defender: strikeStatsFromBot(target),
    targetHp: target.hp,
    forceCrit: swing.forceCrit,
    critChance: swing.critChance,
    random: input.random,
    rules: input.rules,
  });
  const { extra, purges: overlayPurges } = rollOverlayExtra(
    actor.effects,
    actor.mag,
    target,
    outcome.applied < 1 ? target.hp : Math.max(0, target.hp - outcome.applied),
    input.random,
    input.rules,
  );
  resolveHpLoss(target, outcome.applied);
  if (extra) resolveHpLoss(target, -extra.hpChange);
  actor.creditDealtDamage(outcome.applied + (extra ? -extra.hpChange : 0));
  const killed = target.hp === 0;
  return [
    {
      type: "damage",
      sourceId: actor.fightId,
      targetId: target.fightId,
      animation: "attack_center",
      hpChange: -outcome.applied,
      targetMaxHp: target.maxHp,
      killed,
      react: outcome.react,
      ...(extra ? { extraHits: [extra] } : {}),
    },
    ...swing.purges,
    ...overlayPurges,
  ];
}
