import type { BattleEvent } from "./battle-event.ts";
import type { CombatPocketRow } from "./combat-loadout.ts";
import type { FightEffectSnap } from "./standing-effect.ts";
import { pocketSpellWireFlags } from "./pocket-spell-wire-flags.ts";

export function pocketEffectUse(
  row: Pick<CombatPocketRow, "artifactId" | "title" | "picture" | "spell">,
  persId: number,
  kind: number,
  dmgType?: number,
  standing?: Pick<FightEffectSnap, "id" | "remainTime" | "sourceId">,
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
    ...(standing !== undefined
      ? {
          id: standing.id,
          sourceId: standing.sourceId,
          ...(standing.remainTime !== undefined ? { remainTime: standing.remainTime } : {}),
        }
      : {}),
  };
}
