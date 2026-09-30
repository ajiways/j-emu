import type { BattleEvent } from "./battle-event.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import type { BattleRules } from "./battle-rules.ts";
import { botSpellAnimation, botSpellKind1DmgType, rollBotSpellDamage } from "./bot-spell-damage.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { pocketHealAmount, spellKind } from "./human-cast-state.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { kind1OverlayCharges, magicReact } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";
import { attachSpellTicks } from "./fight-effect-ticks.ts";

export type BotKindActState = Readonly<{
  rules: BattleRules;
  random: RandomSource;
  fightId: string;
  keepFightOnKill: boolean;
  living: readonly HumanFighter[];
  winnerTeam: 1 | 2;
  nowMs: number;
}>;

export function actBotSpellCard(
  actor: BotFighter,
  target: HumanFighter | BotFighter,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  if (kind1OverlayCharges(card.spell) > 0) {
    return attachKind1Overlay(actor, card);
  }
  if (spellKind(card.spell, 1)) {
    return instantKind1(actor, target, card, state);
  }
  if (spellKind(card.spell, 2)) {
    return healActor(actor, card);
  }
  if (spellKind(card.spell, 10)) {
    return [];
  }
  if (spellKind(card.spell, 8)) {
    const purged = target.effects.dispelGroups(target.effects.standingGroups());
    return purged.map((effectId) => ({ type: "effect-purge" as const, effectId }));
  }
  if (spellKind(card.spell, 18)) {
    const stun = card.spell.effects.find((effect) => effect.kind === 18);
    if (!stun || stun.duration === undefined) {
      throw new Error(`Bot stun ${card.artikulId} duration is required`);
    }
    target.stunnedTurns += Math.max(1, stun.duration);
    return [
      {
        type: "buff-cast",
        animation: card.spell.animData ?? "magic_aoe",
        sourceId: actor.fightId,
        targetId: target.id,
        maxHp: target.maxHp,
      },
    ];
  }
  if (spellKind(card.spell, 4) || spellKind(card.spell, 5)) {
    const ticks = attachSpellTicks(target, actor, card, state.nowMs);
    return [
      ...ticks,
      {
        type: "buff-cast",
        animation: botSpellAnimation(card.spell, card.artikulId),
        sourceId: actor.fightId,
        targetId: target.id,
        maxHp: target.maxHp,
      },
    ];
  }
  if (spellKind(card.spell, 3)) {
    const overlay = schoolOverlayFromKind1(
      { ...card.spell, effects: card.spell.effects },
      actor.strength,
    );
    if (overlay) actor.schoolOverlay = overlay;
    return [
      {
        type: "buff-cast",
        animation: card.spell.animData ?? "magic_baf",
        sourceId: actor.fightId,
        targetId: actor.fightId,
        maxHp: actor.maxHp,
      },
    ];
  }
  if (spellKind(card.spell, 11)) {
    return [];
  }
  throw new Error(`Bot spell ${card.artikulId} has no supported CMB-15 effect`);
}

function attachKind1Overlay(actor: BotFighter, card: HuntBotSpellCard): readonly BattleEvent[] {
  const overlay = schoolOverlayFromKind1(card.spell, actor.strength);
  if (!overlay) throw new Error(`Bot spell ${card.artikulId} overlay charges are required`);
  actor.schoolOverlay = overlay;
  const animation = botSpellAnimation(card.spell, card.artikulId);
  return castChargingBuff(actor, {
    artikulId: card.artikulId,
    title: card.title,
    img: card.picture,
    dmgType: overlay.dmgType,
    remainTurns: overlay.charges,
    ...(card.spell.groupId !== undefined ? { groupId: card.spell.groupId } : {}),
    animation,
    flags: 0,
    castAnimation: animation,
  });
}

function instantKind1(
  actor: BotFighter,
  target: HumanFighter | BotFighter,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  const { applied: damage, killed } = resolveHpLoss(
    target,
    rollBotSpellDamage(
      actor.strength,
      card.spell,
      state.random,
      state.rules,
      actor.mag,
      target.mag,
    ),
    actor,
  );
  if (damage < 1) throw new Error("Bot kind-1 hit the living target for no HP");
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
      ? attachSpellTicks(target, actor, card, state.nowMs)
      : [];
  if (!isHuman(target)) return [...ticks, hit];
  const dRage = target.casts.awardIncomingRage(damage, target.maxHp);
  const events: BattleEvent[] = [...ticks, { ...hit, dRage }];
  if (killed && !state.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: state.winnerTeam, fightId: state.fightId });
  }
  return events;
}

function healActor(actor: BotFighter, card: HuntBotSpellCard): readonly BattleEvent[] {
  const healed = actor.applyHeal(pocketHealAmount(card.spell, actor.maxHp));
  return [
    {
      type: "damage",
      sourceId: actor.fightId,
      targetId: actor.fightId,
      animation: botSpellAnimation(card.spell, card.artikulId),
      hpChange: healed,
      targetMaxHp: actor.maxHp,
      killed: false,
    },
  ];
}

function isHuman(target: HumanFighter | BotFighter): target is HumanFighter {
  return "heroId" in target;
}
