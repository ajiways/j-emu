import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import {
  botSpellAnimation,
  botSpellEndsTurn,
  botSpellKind1DmgType,
  rollBotSpellDamage,
} from "./bot-spell-damage.ts";
import type { MobSpellCard } from "./mob-spell-book.ts";
import type { Participant } from "./participant.ts";
import { spellKind } from "./cast-state.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { magicReact } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { attachSpellTicks } from "./fight-effect-ticks.ts";
import { castSpell, type SpellPresentation } from "./spell-cast.ts";
import type { BotSideHit, BotSpellAct } from "./bot-side-hit.ts";
import type { Fighter } from "./fighter.ts";
import { pickSpellTargets, spellAoeTargetCount, spellKind1IsAoe } from "./spell-aoe.ts";

export type BotKindActState = Readonly<{
  rules: BattleRules;
  random: RandomSource;
  nowMs: number;
  /** Every living enemy of the bot, the aimed foe among them: who an AOE spell may reach. */
  enemies: readonly Fighter[];
}>;

/** A bot shows every spell with its own catalog animation: there is no fallback to fill in. */
const BOT_PRESENTATION: SpellPresentation = {
  healAnimation: null,
  effectAnimation: null,
  castAnimation: null,
  announceHeal: false,
  timedTrailingCast: true,
  selfOnly: false,
  replacesGroup: true,
};

export function actBotSpellCard(
  actor: BotFighter,
  target: Participant,
  card: MobSpellCard,
  state: BotKindActState,
): BotSpellAct {
  const events = castSpell({
    caster: actor,
    foe: () => target,
    allies: [actor],
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
    sequence: null,
  });
  return events === null ? instantKind1(actor, target, card, state) : { events, sideHits: [] };
}

function instantKind1(
  actor: BotFighter,
  target: Participant,
  card: MobSpellCard,
  state: BotKindActState,
): BotSpellAct {
  const others = aoeOthers(actor, target, card, state);
  const { applied: damage, killed } = resolveHpLoss(
    target,
    rollBotSpellDamage(actor.strength, card.spell, state.random, state.rules, actor, target),
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
  const sideHits = others.map((other) => hitOther(actor, other, card, state));
  const dRage = damage < 1 ? 0 : target.awardIncomingRage(damage);
  return { events: [...ticks, { ...hit, dRage }], sideHits };
}

/** The others an AOE spell reaches besides the aimed foe, picked before anyone is hit. */
function aoeOthers(
  actor: BotFighter,
  target: Participant,
  card: MobSpellCard,
  state: BotKindActState,
): readonly Fighter[] {
  if (!spellKind1IsAoe(card.spell)) return [];
  return pickSpellTargets({
    primaryId: target.id,
    enemies: state.enemies,
    count: spellAoeTargetCount(card.spell),
    random: state.random,
  }).filter((other) => other.id !== target.id);
}

function hitOther(
  actor: BotFighter,
  other: Fighter,
  card: MobSpellCard,
  state: BotKindActState,
): BotSideHit {
  const { applied, killed } = resolveHpLoss(
    other,
    rollBotSpellDamage(actor.strength, card.spell, state.random, state.rules, actor, other),
    actor,
  );
  const dRage = applied < 1 ? 0 : other.awardIncomingRage(applied);
  return {
    targetId: other.id,
    killed,
    event: {
      type: "damage",
      sourceId: actor.fightId,
      targetId: other.id,
      animation: botSpellAnimation(card.spell, card.artikulId),
      hpChange: -applied,
      targetMaxHp: other.maxHp,
      killed,
      dmgType: botSpellKind1DmgType(card.spell),
      react: magicReact(killed),
      dRage,
    },
  };
}
