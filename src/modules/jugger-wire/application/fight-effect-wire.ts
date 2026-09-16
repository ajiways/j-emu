import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import type { FightEffectSnap } from "../../combat/domain/hunt-human-fight-effects.ts";

type EffectUse = Extract<CombatEvent, { type: "effect-use" }>;
type EffectPurge = Extract<CombatEvent, { type: "effect-purge" }>;
type BuffCast = Extract<CombatEvent, { type: "buff-cast" }>;

export function fightPersEffEvent(
  persId: number,
  effects: readonly FightEffectSnap[],
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = { et: "persEff", persId };
  for (const [index, fx] of effects.entries()) {
    out[String(index + 1)] = {
      id: fx.id,
      kind: fx.kind,
      persId,
      sourceId: fx.sourceId,
      artikulId: fx.artikulId,
      title: fx.title,
      img: fx.img,
      dmgType: fx.dmgType,
      remainTime: fx.remainTime,
      ...(fx.groupId !== undefined ? { groupId: fx.groupId } : {}),
    };
  }
  return out;
}

export function fightStandingEffectUseEvent(
  fx: FightEffectSnap,
  persId: number,
): Readonly<Record<string, unknown>> {
  return {
    et: "effUse",
    id: fx.id,
    persId,
    sourceId: fx.sourceId,
    artikulId: fx.artikulId,
    title: fx.title,
    img: fx.img,
    kind: fx.kind,
    flags: 0,
    dmgType: fx.dmgType,
    remainTime: fx.remainTime,
    ...(fx.groupId !== undefined ? { groupId: fx.groupId } : {}),
    skills: fx.skills,
  };
}

export function fightEffectUseEvent(event: EffectUse): Readonly<Record<string, unknown>> {
  return {
    et: "effUse",
    id: event.id !== undefined ? event.id : 1,
    persId: event.persId,
    sourceId: event.sourceId !== undefined ? event.sourceId : event.persId,
    artikulId: event.artikulId,
    animData: event.animation,
    title: event.title,
    img: event.img,
    kind: event.kind,
    flags: event.flags,
    hidden: 0,
    ...(event.groupId !== undefined ? { groupId: event.groupId } : {}),
    ...(event.dmgType !== undefined ? { dmgType: event.dmgType } : {}),
    ...(event.remainTime !== undefined ? { remainTime: event.remainTime } : {}),
    ...(event.skills !== undefined ? { skills: event.skills } : {}),
  };
}

export function fightEffectPurgeEvent(event: EffectPurge): Readonly<Record<string, unknown>> {
  return { et: "effPurge", effectId: event.effectId };
}

export function fightBuffCastEvent(event: BuffCast): Readonly<Record<string, unknown>> {
  return {
    animData: event.animation,
    dRage: 0,
    et: "cast",
    ev: [],
    maxHp: event.maxHp,
    persId: event.sourceId,
    targetId: event.targetId,
  };
}

export function fightPersCpEvent(cp: number): Readonly<Record<string, unknown>> {
  return { et: "persCP", cp };
}
