import type { CombatEvent } from "../../combat/ports/combat-port.ts";

type DamageEvent = Extract<CombatEvent, { type: "damage" }>;

export function fightCastEvent(event: DamageEvent): Readonly<Record<string, unknown>> {
  const heal = event.hpChange > 0;
  return {
    animData: event.animation,
    dRage: 0,
    et: "cast",
    react: heal ? 0 : event.killed ? 10 : 2,
    hpSelf: 0,
    hp: 0,
    ev: {
      "1": {
        absorb: 0,
        dRage: event.dRage ?? 0,
        deflect: 0,
        dmgType: heal ? 0 : 1,
        drain: 0,
        et: "hpChange",
        hp: event.hpChange,
        maxHp: event.targetMaxHp,
        persId: event.sourceId,
        react: heal ? 0 : event.killed ? 10 : 2,
        selfReact: 0,
        targetId: event.targetId,
      },
    },
    maxHp: event.targetMaxHp,
    persId: event.sourceId,
    targetId: event.targetId,
  };
}
