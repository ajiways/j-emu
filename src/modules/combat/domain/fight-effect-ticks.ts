import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";
import type { TimedSpellSource } from "./timed-spell.ts";
import { spellSkillValue } from "./magic-hit.ts";

export function attachSpellTicks(
  carrier: Fighter,
  caster: Fighter & Readonly<{ strength: number }>,
  card: TimedSpellSource,
  nowMs: number,
  endsTurn: boolean,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const effect of card.spell.effects) {
    if (effect.kind !== 4 && effect.kind !== 5) continue;
    const snap = carrier.effects.attachTick({
      kind: effect.kind,
      sourceId: caster.id,
      artikulId: card.artikulId,
      title: card.title,
      img: card.picture,
      dmgType: requireTickField(card.artikulId, "dmgType", effect.dmgType),
      ...(card.spell.groupId !== undefined ? { groupId: card.spell.groupId } : {}),
      durationSeconds: requireTickField(card.artikulId, "duration", effect.duration),
      periodSeconds: requireTickField(card.artikulId, "period", effect.period),
      nowMs,
      castEndsTurn: endsTurn,
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      catalogPcStr: spellSkillValue(effect, "pcSTR"),
      catalogStr: spellSkillValue(effect, "STR"),
      casterStrength: caster.strength,
      casterMagPower: caster.mag.power,
      casterMagResist: caster.mag.resist,
    });
    events.push({
      type: "effect-use",
      artikulId: card.artikulId,
      animation: "",
      kind: snap.kind,
      flags: 0,
      img: snap.img,
      title: snap.title,
      persId: carrier.id,
      dmgType: snap.dmgType,
      id: snap.id,
      sourceId: snap.sourceId,
      ...(snap.remainTime !== undefined ? { remainTime: snap.remainTime } : {}),
      ...(snap.groupId !== undefined ? { groupId: snap.groupId } : {}),
    });
  }
  if (events.length < 1) {
    throw new Error(`Spell ${card.artikulId} kind 4/5 did not attach`);
  }
  return events;
}

function requireTickField(artikulId: number, field: string, value: number | undefined): number {
  if (value === undefined) {
    throw new Error(`Spell ${artikulId} kind 4/5 ${field} is required`);
  }
  return value;
}
