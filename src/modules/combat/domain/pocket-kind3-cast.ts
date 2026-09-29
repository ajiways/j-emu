import type { BattleEvent } from "./battle-event.ts";
import type { CombatPocketRow } from "./combat-loadout.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { spellCharging, spellPcStr } from "./human-cast-state.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import { pocketSpellWireFlags } from "./pocket-spell-wire-flags.ts";

export function requirePocketOrb(row: CombatPocketRow): void {
  if (spellCharging(row.spell) < 1) {
    throw new Error(`Pocket artifact ${row.artifactId} kind-3 charging is required`);
  }
  if (spellPcStr(row.spell) < 1) {
    throw new Error(`Pocket artifact ${row.artifactId} kind-3 pcSTR is required`);
  }
}

export function applyPocketKind3(
  human: HumanFighter,
  consumed: CombatPocketRow,
): readonly BattleEvent[] {
  const hits = spellCharging(consumed.spell);
  human.casts.armOrb(spellPcStr(consumed.spell), hits);
  const purges: BattleEvent[] = [];
  if (consumed.spell.groupId !== undefined) {
    for (const effectId of human.effects.dispelGroups([consumed.spell.groupId])) {
      purges.push({ type: "effect-purge", effectId });
    }
  }
  return castChargingBuff(human, {
    artikulId: consumed.artifactId,
    title: consumed.title,
    img: consumed.picture,
    dmgType: 1,
    remainTurns: hits,
    ...(consumed.spell.groupId !== undefined ? { groupId: consumed.spell.groupId } : {}),
    animation: consumed.spell.animData ?? "",
    flags: pocketSpellWireFlags(consumed.spell.flags),
    castAnimation: consumed.spell.animData ?? "botles_strenght_grey",
    before: purges,
  });
}
