import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import {
  botSpellAnimation,
  botSpellEndsTurn,
  botSpellKind1DmgType,
  rollBotSpellDamage,
} from "./bot-spell-damage.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { spellKind } from "./human-cast-state.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { magicReact } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { attachSpellTicks } from "./fight-effect-ticks.ts";
import { castSpell, type SpellPresentation } from "./spell-cast.ts";

export type BotKindActState = Readonly<{
  rules: BattleRules;
  random: RandomSource;
  fightId: string;
  keepFightOnKill: boolean;
  living: readonly HumanFighter[];
  winnerTeam: 1 | 2;
  nowMs: number;
}>;

/** A bot shows every spell with its own catalog animation: there is no fallback to fill in. */
const BOT_PRESENTATION: SpellPresentation = {
  healAnimation: null,
  effectAnimation: null,
  castAnimation: null,
  announceHeal: false,
  timedTrailingCast: true,
  selfOnly: false,
};

export function actBotSpellCard(
  actor: BotFighter,
  target: HumanFighter | BotFighter,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  const events = castSpell({
    caster: actor,
    foe: () => target,
    source: {
      artikulId: card.artikulId,
      title: card.title,
      picture: card.picture,
      spell: card.spell,
      flags: 0,
    },
    nowMs: state.nowMs,
    presentation: BOT_PRESENTATION,
    endsTurn: botSpellEndsTurn(card.spell),
  });
  return events ?? instantKind1(actor, target, card, state);
}

function instantKind1(
  actor: BotFighter,
  target: HumanFighter | BotFighter,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  const { applied: damage, killed } = resolveHpLoss(
    target,
    rollBotSpellDamage(actor.strength, card.spell, state.random, state.rules, actor.mag, target),
    actor,
  );
  const hit: Extract<BattleEvent, { type: "damage" }> = {
    type: "damage",
    sourceId: actor.fightId,
    targetId: target.id,
    animation: botSpellAnimation(card.spell, card.artikulId),
    hpChange: -damage,
    targetMaxHp: target.maxHp,
    killed,
    dmgType: botSpellKind1DmgType(card.spell),
    react: magicReact(killed),
  };
  const ticks =
    !killed && (spellKind(card.spell, 4) || spellKind(card.spell, 5))
      ? attachSpellTicks(
          target,
          actor,
          { ...card, flags: 0 },
          state.nowMs,
          botSpellEndsTurn(card.spell),
        )
      : [];
  if (!isHuman(target)) return [...ticks, hit];
  const dRage = damage < 1 ? 0 : target.casts.awardIncomingRage(damage, target.maxHp);
  const events: BattleEvent[] = [...ticks, { ...hit, dRage }];
  if (killed && !state.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: state.winnerTeam, fightId: state.fightId });
  }
  return events;
}

function isHuman(target: HumanFighter | BotFighter): target is HumanFighter {
  return "heroId" in target;
}
