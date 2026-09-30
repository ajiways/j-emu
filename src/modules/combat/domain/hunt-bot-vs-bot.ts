import { spendStunTurn } from "./apply-stun.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { actBotSpellCard } from "./bot-spell-act.ts";
import { botSpellEndsTurn } from "./bot-spell-damage.ts";
import type { BotMeleeResult } from "./hunt-melee.ts";
import type { Fighter } from "./fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { strikeFighter } from "./melee-strike.ts";
import { snapshotForBot } from "./combat-snapshot.ts";
import type { RandomSource } from "./random-source.ts";

export function resolveRosterBotTurn(
  actor: BotFighter,
  target: BotFighter,
  input: Readonly<{
    rules: BattleRules;
    random: RandomSource;
    nowMs: number;
    enemies: readonly Fighter[];
  }>,
): BotMeleeResult {
  if (actor.hp === 0) throw new Error("Roster bot actor is dead");
  if (target.hp === 0) throw new Error("Roster bot target is dead");
  if (actor.stunnedTurns > 0) {
    return { events: spendStunTurn(actor), killedPlayer: false, sideHits: [] };
  }
  const decision = actor.brain.decide(snapshotForBot(actor, target), input.random);
  if (decision.kind === "melee") {
    return { events: [...meleeHit(actor, target, input)], killedPlayer: false, sideHits: [] };
  }
  const card = decision.card;
  const act = actBotSpellCard(actor, target, card, {
    rules: input.rules,
    random: input.random,
    fightId: "roster",
    keepFightOnKill: true,
    living: [],
    winnerTeam: 1,
    nowMs: input.nowMs,
    enemies: input.enemies,
  });
  const events = [...act.events];
  if (target.hp > 0 && (kind1OverlayCharges(card.spell) > 0 || !botSpellEndsTurn(card.spell))) {
    events.push(...meleeHit(actor, target, input));
  }
  return { events, killedPlayer: false, sideHits: act.sideHits };
}

function meleeHit(
  actor: BotFighter,
  target: BotFighter,
  input: Readonly<{ rules: BattleRules; random: RandomSource }>,
): readonly BattleEvent[] {
  const strike = strikeFighter({
    attacker: actor,
    attackerStrength: actor.meleeStrength(),
    attackerStats: actor.strikeStats(),
    target,
    targetStats: target.strikeStats(),
    random: input.random,
    rules: input.rules,
  });
  const { outcome, extra, drained, killed, dRage } = strike;
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
      dRage,
      ...(drained.healed > 0 ? { drain: drained.healed, selfReact: drained.selfReact } : {}),
      ...(extra ? { extraHits: [extra] } : {}),
    },
    ...(drained.hurtEvent ? [drained.hurtEvent] : []),
    ...strike.purges,
  ];
}
