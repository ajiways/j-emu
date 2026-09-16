import type { BattleEvent } from "./battle-event.ts";
import type { CombatPocketRow } from "./combat-loadout.ts";
import { pocketSpellWireFlags } from "./pocket-spell-wire-flags.ts";

export function pocketEffectUse(
  row: CombatPocketRow,
  persId: number,
  kind: number,
  dmgType?: number,
): BattleEvent {
  return {
    type: "effect-use",
    artikulId: row.artifactId,
    animation: row.spell.animData ?? "",
    kind,
    flags: pocketSpellWireFlags(row.spell.flags),
    img: row.picture,
    title: row.title,
    persId,
    ...(row.spell.groupId !== undefined ? { groupId: row.spell.groupId } : {}),
    ...(dmgType !== undefined ? { dmgType } : {}),
  };
}
