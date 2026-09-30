import { spendStunTurn } from "./apply-stun.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { BotSpellAct } from "./bot-side-hit.ts";
import { actBotSpellCard } from "./bot-spell-act.ts";
import { botSpellEndsTurn } from "./bot-spell-damage.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { snapshotForBot } from "./combat-snapshot.ts";
import type { Fighter } from "./fighter.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { strikeEvents, strikeFighter } from "./melee-strike.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";

export type AiTurnState = Readonly<{
  rules: BattleRules;
  random: RandomSource;
  nowMs: number;
  /** Every living enemy of the bot, the foe among them: who an AOE spell may reach. */
  enemies: readonly Fighter[];
}>;

/**
 * One turn of an AI-controlled participant against whoever stands across from him: the brain
 * decides, a spell or a strike is carried out the same way for every foe. Who fell, and what that
 * means for the fight, is settled by the caller.
 */
export function resolveAiTurn(bot: BotFighter, foe: Participant, state: AiTurnState): BotSpellAct {
  if (bot.stunnedTurns > 0) return { events: spendStunTurn(bot), sideHits: [] };
  const decision = bot.brain.decide(snapshotForBot(bot, foe), state.random);
  if (decision.kind === "melee") return { events: strike(bot, foe, state), sideHits: [] };
  const act = actBotSpellCard(bot, foe, decision.card, state);
  const { spell } = decision.card;
  if (foe.alive && (kind1OverlayCharges(spell) > 0 || !botSpellEndsTurn(spell))) {
    return { events: [...act.events, ...strike(bot, foe, state)], sideHits: act.sideHits };
  }
  return act;
}

function strike(bot: BotFighter, foe: Participant, state: AiTurnState) {
  const result = strikeFighter({
    attacker: bot,
    attackerStrength: bot.meleeStrength(),
    attackerStats: bot.strikeStats(),
    target: foe,
    targetStats: foe.strikeStats(),
    random: state.random,
    rules: state.rules,
  });
  return strikeEvents({
    attacker: bot,
    target: foe,
    strike: result,
    animation: "attack_center",
  });
}
