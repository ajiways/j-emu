import type { CombatEvent } from "../../combat/ports/combat-port.ts";

type EffectUse = Extract<CombatEvent, { type: "effect-use" }>;
type BuffCast = Extract<CombatEvent, { type: "buff-cast" }>;
type NativeCount = Extract<CombatEvent, { type: "native-count" }>;

export function fightEffectUseEvent(event: EffectUse): Readonly<Record<string, unknown>> {
  return {
    et: "effUse",
    id: 1,
    persId: event.persId,
    sourceId: event.persId,
    artikulId: event.artikulId,
    animData: event.animation,
    title: event.title,
    img: event.img,
    kind: event.kind,
    flags: event.flags,
    hidden: 0,
    ...(event.groupId !== undefined ? { groupId: event.groupId } : {}),
    ...(event.dmgType !== undefined ? { dmgType: event.dmgType } : {}),
  };
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

export function fightNativeCountEvent(event: NativeCount): Readonly<Record<string, unknown>> {
  return {
    et: "persSpells",
    "1": {
      count: event.count,
      persRestr: { dead: false },
      srcId: event.srcId,
      srcType: 1,
      targetRestr: { dead: false, oppTeam: true },
      title: event.title,
    },
  };
}
