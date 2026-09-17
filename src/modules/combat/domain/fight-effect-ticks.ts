import type { BattleEvent } from "./battle-event.ts";
import { DOT_DURATION_TURNS } from "./dot-duration-turns.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { spellSkillValue } from "./magic-hit.ts";

/** Named jgr period when catalog kind-4/5 omits `period` (CMB-15c). */
const TICK_PERIOD_SECONDS = 20;

export function attachSpellTicks(
  carrier: HuntHuman,
  caster: HuntRosterBot,
  card: HuntBotSpellCard,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const effect of card.spell.effects) {
    if (effect.kind !== 4 && effect.kind !== 5) continue;
    const snap = carrier.effects.attachTick({
      kind: effect.kind,
      sourceId: caster.fightId,
      artikulId: card.artikulId,
      title: card.title,
      img: card.picture,
      dmgType: requireTickDmgType(card.artikulId, effect.dmgType),
      ...(card.spell.groupId !== undefined ? { groupId: card.spell.groupId } : {}),
      ticks: tickBudget(card.artikulId, effect.duration, effect.period),
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      catalogPcStr: spellSkillValue(effect, "pcSTR"),
      catalogStr: spellSkillValue(effect, "STR"),
      casterStrength: caster.strength,
      casterMagPower: caster.magPower,
      casterMagResist: caster.magResist,
    });
    events.push({
      type: "effect-use",
      artikulId: card.artikulId,
      animation: "",
      kind: snap.kind,
      flags: 0,
      img: snap.img,
      title: snap.title,
      persId: carrier.heroId,
      dmgType: snap.dmgType,
      id: snap.id,
      sourceId: snap.sourceId,
      remainTime: snap.remainTime,
      ...(snap.groupId !== undefined ? { groupId: snap.groupId } : {}),
    });
  }
  if (events.length < 1) {
    throw new Error(`Bot spell ${card.artikulId} kind 4/5 did not attach`);
  }
  return events;
}

function requireTickDmgType(artikulId: number, dmgType: number | undefined): number {
  if (dmgType === undefined) {
    throw new Error(`Bot spell ${artikulId} kind 4/5 dmgType is required`);
  }
  return dmgType;
}

function tickBudget(
  artikulId: number,
  duration: number | undefined,
  period: number | undefined,
): number {
  const overlay = DOT_DURATION_TURNS[artikulId];
  if (overlay !== undefined) {
    if (!Number.isInteger(overlay) || overlay < 1) {
      throw new Error(`Bot spell ${artikulId} durationTurns overlay is invalid`);
    }
    return overlay;
  }
  if (duration === undefined) {
    throw new Error(`Bot spell ${artikulId} kind 4/5 duration is required`);
  }
  const step = period !== undefined && period > 0 ? period : TICK_PERIOD_SECONDS;
  return Math.max(1, Math.round(duration / step));
}
