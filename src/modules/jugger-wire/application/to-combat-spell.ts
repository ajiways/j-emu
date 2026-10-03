import type { ArtifactSpell } from "../../catalog/domain/artifact-spell.ts";
import type { CombatSpell } from "../../combat/domain/combat-loadout.ts";

export function toCombatSpell(spell: ArtifactSpell): CombatSpell {
  return {
    ...(spell.animData !== undefined ? { animData: spell.animData } : {}),
    ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
    ...(spell.cooldown !== undefined ? { cooldown: spell.cooldown } : {}),
    ...(spell.triggerCount !== undefined ? { triggerCount: spell.triggerCount } : {}),
    ...(spell.mpCost !== undefined ? { mpCost: spell.mpCost } : {}),
    ...(spell.endTurn !== undefined ? { endTurn: spell.endTurn } : {}),
    ...(spell.flags !== undefined ? { flags: spell.flags } : {}),
    ...(spell.persRestr !== undefined ? { persRestr: spell.persRestr } : {}),
    ...(spell.targetRestr !== undefined ? { targetRestr: spell.targetRestr } : {}),
    ...(spell.triggers !== undefined ? { triggers: spell.triggers } : {}),
    ...(spell.onlyPvP !== undefined ? { onlyPvP: spell.onlyPvP } : {}),
    effects: spell.effects.map((effect) => ({
      kind: effect.kind,
      ...(effect.order !== undefined ? { order: effect.order } : {}),
      ...(effect.hidden !== undefined ? { hidden: effect.hidden } : {}),
      ...(effect.dmgMask !== undefined ? { dmgMask: effect.dmgMask } : {}),
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      ...(effect.dmgType !== undefined ? { dmgType: effect.dmgType } : {}),
      ...(effect.charging !== undefined ? { charging: effect.charging } : {}),
      ...(effect.capacity !== undefined ? { capacity: effect.capacity } : {}),
      ...(effect.targetCount !== undefined ? { targetCount: effect.targetCount } : {}),
      ...(effect.targetEffectGroupId !== undefined
        ? { targetEffectGroupId: effect.targetEffectGroupId }
        : {}),
      ...(effect.duration !== undefined ? { duration: effect.duration } : {}),
      ...(effect.durationInTurns !== undefined ? { durationInTurns: effect.durationInTurns } : {}),
      ...(effect.period !== undefined ? { period: effect.period } : {}),
      ...(effect.forceSelfTargeting !== undefined
        ? { forceSelfTargeting: effect.forceSelfTargeting }
        : {}),
      ...(effect.realStartTime !== undefined ? { realStartTime: effect.realStartTime } : {}),
      ...(effect.botArtikulId !== undefined ? { botArtikulId: effect.botArtikulId } : {}),
      ...(effect.manaCost !== undefined ? { manaCost: effect.manaCost } : {}),
      ...(effect.limit !== undefined ? { limit: effect.limit } : {}),
      ...(effect.delta !== undefined ? { delta: effect.delta } : {}),
      ...(effect.skills ? { skills: effect.skills } : {}),
    })),
  };
}
