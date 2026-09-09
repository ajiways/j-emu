import type { CombatEvent } from "../../combat/ports/combat-port.ts";

type DamageEvent = Extract<CombatEvent, { type: "damage" }>;

export function fightCastEvent(event: DamageEvent): Readonly<Record<string, unknown>> {
  return {
    animData: event.animation,
    dRage: 0,
    et: "cast",
    react: event.killed ? 10 : 2,
    hpSelf: 0,
    hp: 0,
    ev: {
      "1": {
        absorb: 0,
        dRage: 0,
        deflect: 0,
        dmgType: 1,
        drain: 0,
        et: "hpChange",
        hp: event.hpChange,
        maxHp: event.targetMaxHp,
        persId: event.sourceId,
        react: event.killed ? 10 : 2,
        selfReact: 0,
        targetId: event.targetId,
      },
    },
    maxHp: event.targetMaxHp,
    persId: event.sourceId,
    targetId: event.targetId,
  };
}
