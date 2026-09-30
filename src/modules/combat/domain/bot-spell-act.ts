import { applyStunSpell } from "./apply-stun.ts";
import { dispelTargetGroups } from "./dispel-target-groups.ts";
import type { BattleEvent } from "./battle-event.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import type { BattleRules } from "./battle-rules.ts";
import { botSpellAnimation, botSpellKind1DmgType, rollBotSpellDamage } from "./bot-spell-damage.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { pocketHealAmount, spellCharging, spellKind } from "./human-cast-state.ts";
import { chargedSkills, strikeModsFromSkills, strikeModsOfOverlay } from "./strike-mods.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { kind1OverlayCharges, magicReact } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";
import { castTimedSpell, isTimedSpell } from "./timed-spell.ts";
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
  if (isTimedSpell(card.spell)) return castTimed(actor, target, card, state.nowMs);
  if (spellKind(card.spell, 2)) {
    return healActor(actor, card);
  }
  if (spellKind(card.spell, 10)) {
    return [];
  }
  if (spellKind(card.spell, 8)) {
    const purged = target.effects.dispelGroups(dispelTargetGroups(card.spell));
    return purged.map((effectId) => ({ type: "effect-purge" as const, effectId }));
  }
  if (spellKind(card.spell, 18)) {
    return [
      ...applyStunSpell(actor, target, { ...card, flags: 0 }, state.nowMs),
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
  if (spellKind(card.spell, 3)) return attachChargedKind3(actor, card);
  if (spellKind(card.spell, 11)) {
    return [];
  }
  throw new Error(`Bot spell ${card.artikulId} has no supported CMB-15 effect`);
}

/** A timed buff or debuff: on the bot itself when the spell is cast on oneself, else on its foe. */
function castTimed(
  actor: BotFighter,
  foe: HumanFighter | BotFighter,
  card: HuntBotSpellCard,
  nowMs: number,
): readonly BattleEvent[] {
  const { spell } = card;
  const carrier = castsOnSelf(spell) ? actor : foe;
  return [
    ...castTimedSpell(
      actor,
      carrier,
      { artikulId: card.artikulId, title: card.title, picture: card.picture, spell, flags: 0 },
      nowMs,
    ),
    {
      type: "buff-cast",
      animation: botSpellAnimation(spell, card.artikulId),
      sourceId: actor.fightId,
      targetId: carrier.id,
      maxHp: carrier.maxHp,
    },
  ];
}

function castsOnSelf(spell: HuntBotSpellCard["spell"]): boolean {
  return spell.targetRestr?.self === true || spell.effects.some((e) => e.forceSelfTargeting);
}

function attachKind1Overlay(actor: BotFighter, card: HuntBotSpellCard): readonly BattleEvent[] {
  const overlay = schoolOverlayFromKind1(card.spell, actor.strength);
  if (!overlay) throw new Error(`Bot spell ${card.artikulId} overlay charges are required`);
  const animation = botSpellAnimation(card.spell, card.artikulId);
  return castChargingBuff(actor, {
    artikulId: card.artikulId,
    title: card.title,
    img: card.picture,
    dmgType: overlay.dmgType,
    remainTurns: overlay.charges,
    strike: strikeModsOfOverlay(overlay),
    ...(card.spell.groupId !== undefined ? { groupId: card.spell.groupId } : {}),
    animation,
    flags: 0,
    castAnimation: animation,
  });
}

/** A charged kind-3 spell of a bot (an orb, a rage): spent by its next swings like a player's. */
function attachChargedKind3(actor: BotFighter, card: HuntBotSpellCard): readonly BattleEvent[] {
  const animation = card.spell.animData ?? "magic_baf";
  return castChargingBuff(actor, {
    artikulId: card.artikulId,
    title: card.title,
    img: card.picture,
    dmgType: card.spell.effects.find((effect) => effect.kind === 3)?.dmgType ?? 1,
    remainTurns: spellCharging(card.spell) || 1,
    strike: strikeModsFromSkills(chargedSkills(card.spell)),
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
      ? attachSpellTicks(target, actor, card, state.nowMs)
      : [];
  if (!isHuman(target)) return [...ticks, hit];
  const dRage = damage < 1 ? 0 : target.casts.awardIncomingRage(damage, target.maxHp);
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
