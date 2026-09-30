import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { startPeriodic } from "./periodic-effect.ts";
import { bakeSkills, type SkillValue, type StatBase } from "./skill-bake.ts";
import type { StandingEffect } from "./standing-effect.ts";

export type TimedBuffInput = Readonly<{
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  groupId?: number;
  skills: readonly SkillValue[];
  /** Fight-clock seconds; `null` — no duration in the data, the buff lasts to the end of the fight. */
  durationSeconds: number | null;
  nowMs: number;
  castEndsTurn: boolean;
  base: StatBase;
}>;

/** A kind-3 buff that is not spent by strikes: baked skills that age on the fight clock. */
export function timedBuffEffect(id: number, input: TimedBuffInput): StandingEffect {
  requireWireIdentity(input.sourceId, "timed buff source id");
  requireWireIdentity(input.artikulId, "timed buff artikul id");
  if (!input.title) throw new Error(`Timed buff ${input.artikulId} title is required`);
  if (!input.img) throw new Error(`Timed buff ${input.artikulId} img is required`);
  return {
    id,
    kind: 3,
    sourceId: input.sourceId,
    artikulId: input.artikulId,
    title: input.title,
    img: input.img,
    dmgType: input.dmgType,
    ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
    skills: bakeSkills(input.skills, input.base),
    remainTurns: 0,
    expiresAtMs: Number.MAX_SAFE_INTEGER,
    ...(input.durationSeconds === null
      ? { fightLong: true }
      : {
          periodic: startPeriodic({
            durationSeconds: input.durationSeconds,
            periodSeconds: null,
            nowMs: input.nowMs,
            castEndsTurn: input.castEndsTurn,
          }),
        }),
  };
}
