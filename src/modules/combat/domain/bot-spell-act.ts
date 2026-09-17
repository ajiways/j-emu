import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { botSpellAnimation, botSpellKind1DmgType, rollBotSpellDamage } from "./bot-spell-damage.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { pocketHealAmount, spellKind } from "./hunt-human-cast-state.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { kind1OverlayCharges, magicReact } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";
import { attachSpellTicks } from "./fight-effect-ticks.ts";

export type BotKindActState = Readonly<{
  rules: BattleRules;
  random: RandomSource;
  fightId: string;
  keepFightOnKill: boolean;
  living: readonly HuntHuman[];
  winnerTeam: 1 | 2;
}>;

export function actBotSpellCard(
  actor: HuntRosterBot,
  target: HuntHuman | HuntRosterBot,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  if (kind1OverlayCharges(card.spell) > 0) {
    actor.schoolOverlay = schoolOverlayFromKind1(card.spell, actor.strength);
    return [
      {
        type: "buff-cast",
        animation: botSpellAnimation(card.spell, card.artikulId),
        sourceId: actor.fightId,
        targetId: actor.fightId,
        maxHp: actor.maxHp,
      },
    ];
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
    if (isHuman(target)) {
      const groups = target.effects.standingGroups();
      const purged = target.effects.dispelGroups(groups);
      return purged.map((effectId) => ({ type: "effect-purge" as const, effectId }));
    }
    return [];
  }
  if (spellKind(card.spell, 18)) {
    const stun = card.spell.effects.find((effect) => effect.kind === 18);
    if (!stun || stun.duration === undefined) {
      throw new Error(`Bot stun ${card.artikulId} duration is required`);
    }
    const turns = Math.max(1, stun.duration);
    if (isHuman(target)) target.stunnedTurns += turns;
    else target.stunnedTurns += turns;
    return [
      {
        type: "buff-cast",
        animation: card.spell.animData ?? "magic_aoe",
        sourceId: actor.fightId,
        targetId: isHuman(target) ? target.heroId : target.fightId,
        maxHp: isHuman(target) ? target.maxHp : target.maxHp,
      },
    ];
  }
  if (spellKind(card.spell, 4) || spellKind(card.spell, 5)) {
    const ticks = isHuman(target) ? attachSpellTicks(target, actor, card) : [];
    return [
      ...ticks,
      {
        type: "buff-cast",
        animation: botSpellAnimation(card.spell, card.artikulId),
        sourceId: actor.fightId,
        targetId: isHuman(target) ? target.heroId : target.fightId,
        maxHp: isHuman(target) ? target.maxHp : target.maxHp,
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

function instantKind1(
  actor: HuntRosterBot,
  target: HuntHuman | HuntRosterBot,
  card: HuntBotSpellCard,
  state: BotKindActState,
): readonly BattleEvent[] {
  if (!isHuman(target)) {
    const damage = appliedHpLoss(
      rollBotSpellDamage(
        actor.strength,
        card.spell,
        state.random,
        state.rules,
        actor.mag,
        target.mag,
      ),
      target.hp,
    );
    if (damage < 1) throw new Error("Bot kind-1 hit the living target for no HP");
    const killed = target.applyDamage(damage);
    actor.creditDealtDamage(damage);
    return [
      {
        type: "damage",
        sourceId: actor.fightId,
        targetId: target.fightId,
        animation: botSpellAnimation(card.spell, card.artikulId),
        hpChange: -damage,
        targetMaxHp: target.maxHp,
        killed,
        dmgType: botSpellKind1DmgType(card.spell),
        react: magicReact(killed),
      },
    ];
  }
  const damage = appliedHpLoss(
    rollBotSpellDamage(
      actor.strength,
      card.spell,
      state.random,
      state.rules,
      actor.mag,
      target.mag,
    ),
    target.hp,
  );
  if (damage < 1) throw new Error("Bot kind-1 hit the living target for no HP");
  const killed = target.applyDamage(damage);
  actor.creditDealtDamage(damage);
  const dRage = target.casts.awardIncomingRage(damage, target.maxHp);
  const ticks =
    !killed && (spellKind(card.spell, 4) || spellKind(card.spell, 5))
      ? attachSpellTicks(target, actor, card)
      : [];
  const events: BattleEvent[] = [
    ...ticks,
    {
      type: "damage",
      sourceId: actor.fightId,
      targetId: target.heroId,
      animation: botSpellAnimation(card.spell, card.artikulId),
      hpChange: -damage,
      targetMaxHp: target.maxHp,
      killed,
      dRage,
      dmgType: botSpellKind1DmgType(card.spell),
      react: magicReact(killed),
    },
  ];
  if (killed && !state.keepFightOnKill) {
    events.push({ type: "finished", winnerTeam: state.winnerTeam, fightId: state.fightId });
  }
  return events;
}

function healActor(actor: HuntRosterBot, card: HuntBotSpellCard): readonly BattleEvent[] {
  const healed = Math.min(actor.maxHp - actor.hp, pocketHealAmount(card.spell, actor.maxHp));
  actor.setHp(actor.hp + healed);
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

function isHuman(target: HuntHuman | HuntRosterBot): target is HuntHuman {
  return "heroId" in target;
}
