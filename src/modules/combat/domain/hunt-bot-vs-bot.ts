import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { actBotSpellCard } from "./bot-spell-act.ts";
import { botSpellEndsTurn } from "./bot-spell-damage.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import { rollMeleeOutcome, unpublishedBotStrikeStats } from "./melee-outcome.ts";
import { rollOverlayExtra } from "./melee-school-overlay.ts";
import { consumeOverlayCharge } from "./consume-overlay-charge.ts";
import { noteCast, pickBotSpell } from "./pick-bot-spell.ts";
import type { RandomSource } from "./random-source.ts";

export function resolveRosterBotTurn(
  actor: HuntRosterBot,
  target: HuntRosterBot,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
  }>,
): readonly BattleEvent[] {
  if (actor.hp === 0) throw new Error("Roster bot actor is dead");
  if (target.hp === 0) throw new Error("Roster bot target is dead");
  if (actor.stunnedTurns > 0) {
    actor.stunnedTurns -= 1;
    return [];
  }
  const card = pickBotSpell(
    actor.spellBook,
    { botHp: actor.hp, botMaxHp: actor.maxHp, casts: actor.casts },
    input.random,
  );
  if (!card) return [...meleeHit(actor, target, input)];
  noteCast(actor.casts, card.artikulId);
  const events = [
    ...actBotSpellCard(actor, target, card, {
      rules: input.rules,
      random: input.random,
      fightId: "roster",
      keepFightOnKill: true,
      living: [],
      winnerTeam: 1,
    }),
  ];
  if (target.hp > 0 && (kind1OverlayCharges(card.spell) > 0 || !botSpellEndsTurn(card.spell))) {
    events.push(...meleeHit(actor, target, input));
  }
  return events;
}

function meleeHit(
  actor: HuntRosterBot,
  target: HuntRosterBot,
  input: Readonly<{ rules: BattleRules; random: RandomSource }>,
): readonly BattleEvent[] {
  const baseDamage = rollMeleeDamage(actor.strength, input.random, input.rules);
  const outcome = rollMeleeOutcome({
    baseDamage,
    attacker: unpublishedBotStrikeStats(actor.strength),
    defender: unpublishedBotStrikeStats(target.strength),
    targetHp: target.hp,
    forceCrit: false,
    random: input.random,
    rules: input.rules,
  });
  const overlayBefore = actor.schoolOverlay;
  const extra = rollOverlayExtra(
    actor,
    actor.mag,
    target.mag,
    outcome.applied < 1 ? target.hp : Math.max(0, target.hp - outcome.applied),
    input.random,
    input.rules,
  );
  if (outcome.applied > 0) target.applyDamage(outcome.applied);
  if (extra) target.applyDamage(-extra.hpChange);
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
    ...consumeOverlayCharge(actor, overlayBefore),
  ];
}
