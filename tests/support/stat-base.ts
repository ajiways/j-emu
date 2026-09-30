import type { StatBase } from "../../src/modules/combat/domain/skill-bake.ts";

/** A fighter's own stats for effect baking; only strength matters unless a test says otherwise. */
export function unitStatBase(strength: number, rest: Partial<StatBase> = {}): StatBase {
  return { STR: strength, DEX: 0, DEF: 0, RAG: 0, BLOK: 0, HPMAX: 100, ...rest };
}
