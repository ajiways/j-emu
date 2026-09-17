import type { CombatEvent } from "../../combat/ports/combat-port.ts";

type DamageEvent = Extract<CombatEvent, { type: "damage" }>;

export function fightCastEvent(event: DamageEvent): Readonly<Record<string, unknown>> {
  if (event.animation === "") {
    throw new Error("Empty-anim tick damage must be a sibling hpChange on the carrier melee map");
  }
  const heal = event.hpChange > 0;
  const react = event.react ?? (heal ? 0 : event.killed ? 10 : 2);
  return {
    animData: event.animation,
    dRage: 0,
    et: "cast",
    react,
    hpSelf: 0,
    hp: 0,
    ev: extraHits(event),
    maxHp: event.targetMaxHp,
    persId: event.sourceId,
    targetId: event.targetId,
  };
}

function extraHits(event: DamageEvent): Record<string, unknown> {
  const heal = event.hpChange > 0;
  const react = event.react ?? (heal ? 0 : event.killed ? 10 : 2);
  const nested: Record<string, unknown> = {
    "1": hpChangeRow(event, react, heal),
  };
  event.extraHits?.forEach((hit, index) => {
    nested[String(index + 2)] = {
      absorb: 0,
      dRage: 0,
      deflect: 0,
      dmgType: hit.dmgType,
      drain: 0,
      et: "hpChange",
      hp: hit.hpChange,
      maxHp: event.targetMaxHp,
      persId: event.sourceId,
      react: hit.react,
      selfReact: 0,
      targetId: event.targetId,
    };
  });
  return nested;
}

export function fightSiblingHpChangeEvent(event: DamageEvent): Readonly<Record<string, unknown>> {
  if (event.animation !== "") {
    throw new Error("Sibling hpChange requires empty animation");
  }
  const heal = event.hpChange > 0;
  const react = event.react ?? (heal ? 0 : event.killed ? 10 : 2);
  return hpChangeRow(event, react, heal);
}

function hpChangeRow(event: DamageEvent, react: number, heal: boolean): Record<string, unknown> {
  return {
    absorb: 0,
    dRage: event.dRage ?? 0,
    deflect: 0,
    dmgType: heal ? 0 : (event.dmgType ?? 1),
    drain: 0,
    et: "hpChange",
    hp: event.hpChange,
    maxHp: event.targetMaxHp,
    persId: event.sourceId,
    react,
    selfReact: 0,
    targetId: event.targetId,
  };
}
