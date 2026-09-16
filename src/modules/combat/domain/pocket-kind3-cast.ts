import type { BattleEvent } from "./battle-event.ts";
import type { CombatPocketRow } from "./combat-loadout.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { spellCharging, spellPcStr } from "./hunt-human-cast-state.ts";
import { pocketEffectUse } from "./pocket-effect-use.ts";

export function requirePocketOrb(row: CombatPocketRow): void {
  if (spellCharging(row.spell) < 1) {
    throw new Error(`Pocket artifact ${row.artifactId} kind-3 charging is required`);
  }
  if (spellPcStr(row.spell) < 1) {
    throw new Error(`Pocket artifact ${row.artifactId} kind-3 pcSTR is required`);
  }
}

export function applyPocketKind3(
  human: HuntHuman,
  consumed: CombatPocketRow,
): readonly BattleEvent[] {
  const hits = spellCharging(consumed.spell);
  human.casts.armOrb(spellPcStr(consumed.spell), hits);
  const events: BattleEvent[] = [];
  if (consumed.spell.groupId !== undefined) {
    for (const effectId of human.effects.dispelGroups([consumed.spell.groupId])) {
      events.push({ type: "effect-purge", effectId });
    }
  }
  const standing = human.effects.attachChargingKind3({
    sourceId: human.heroId,
    artikulId: consumed.artifactId,
    title: consumed.title,
    img: consumed.picture,
    dmgType: 1,
    remainTurns: hits,
    ...(consumed.spell.groupId !== undefined ? { groupId: consumed.spell.groupId } : {}),
  });
  events.push(pocketEffectUse(consumed, human.heroId, 3, 1, standing), {
    type: "buff-cast",
    animation: consumed.spell.animData ?? "botles_strenght_grey",
    sourceId: human.heroId,
    targetId: human.heroId,
    maxHp: human.maxHp,
  });
  return events;
}
