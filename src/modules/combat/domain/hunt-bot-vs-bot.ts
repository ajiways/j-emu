import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import {
  botSpellAnimation,
  botSpellEndsTurn,
  botSpellKind1DmgType,
  rollBotSpellDamage,
} from "./bot-spell-damage.ts";
import { pocketHealAmount, spellKind } from "./hunt-human-cast-state.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
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
  const card = pickBotSpell(
    actor.spellBook,
    { botHp: actor.hp, botMaxHp: actor.maxHp, casts: actor.casts },
    input.random,
  );
  if (!card) return [meleeHit(actor, target, input)];
  noteCast(actor.casts, card.artikulId);
  if (spellKind(card.spell, 1)) {
    const struck = kind1Hit(actor, target, card.artikulId, card.spell, input);
    if (!botSpellEndsTurn(card.spell) && target.hp > 0) {
      return [struck, meleeHit(actor, target, input)];
    }
    return [struck];
  }
  if (spellKind(card.spell, 2)) return [healSelf(actor, card.artikulId, card.spell)];
  throw new Error(`Bot spell ${card.artikulId} has no supported CMB-06 effect`);
}

function meleeHit(
  actor: HuntRosterBot,
  target: HuntRosterBot,
  input: Readonly<{ rules: BattleRules; random: RandomSource }>,
): BattleEvent {
  const damage = rollMeleeDamage(actor.strength, input.random, input.rules);
  const killed = target.applyDamage(damage);
  return {
    type: "damage",
    sourceId: actor.fightId,
    targetId: target.fightId,
    animation: "attack_center",
    hpChange: -damage,
    targetMaxHp: target.maxHp,
    killed,
  };
}

function kind1Hit(
  actor: HuntRosterBot,
  target: HuntRosterBot,
  artikulId: number,
  spell: HuntRosterBot["spellBook"]["spells"][number]["spell"],
  input: Readonly<{ rules: BattleRules; random: RandomSource }>,
): BattleEvent {
  const damage = rollBotSpellDamage(actor.strength, spell, input.random, input.rules);
  const killed = target.applyDamage(damage);
  return {
    type: "damage",
    sourceId: actor.fightId,
    targetId: target.fightId,
    animation: botSpellAnimation(spell, artikulId),
    hpChange: -damage,
    targetMaxHp: target.maxHp,
    killed,
    dmgType: botSpellKind1DmgType(spell),
  };
}

function healSelf(
  actor: HuntRosterBot,
  artikulId: number,
  spell: HuntRosterBot["spellBook"]["spells"][number]["spell"],
): BattleEvent {
  const healed = Math.min(actor.maxHp - actor.hp, pocketHealAmount(spell, actor.maxHp));
  actor.setHp(actor.hp + healed);
  return {
    type: "damage",
    sourceId: actor.fightId,
    targetId: actor.fightId,
    animation: botSpellAnimation(spell, artikulId),
    hpChange: healed,
    targetMaxHp: actor.maxHp,
    killed: false,
  };
}
