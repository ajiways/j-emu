import type { ArtifactSpell } from "../../catalog/domain/artifact-spell.ts";
import type { CombatSpell } from "../../combat/domain/combat-loadout.ts";

export function toCombatSpell(spell: ArtifactSpell): CombatSpell {
  return {
    ...(spell.animData !== undefined ? { animData: spell.animData } : {}),
    ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
    ...(spell.cooldown !== undefined ? { cooldown: spell.cooldown } : {}),
    ...(spell.endTurn !== undefined ? { endTurn: spell.endTurn } : {}),
    ...(spell.flags !== undefined ? { flags: spell.flags } : {}),
    ...(spell.persRestr !== undefined ? { persRestr: spell.persRestr } : {}),
    ...(spell.targetRestr !== undefined ? { targetRestr: spell.targetRestr } : {}),
    ...(spell.triggers !== undefined ? { triggers: spell.triggers } : {}),
    ...(spell.onlyPvP !== undefined ? { onlyPvP: spell.onlyPvP } : {}),
    effects: spell.effects.map((effect) => ({
      kind: effect.kind,
      ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
      ...(effect.dmgType !== undefined ? { dmgType: effect.dmgType } : {}),
      ...(effect.charging !== undefined ? { charging: effect.charging } : {}),
      ...(effect.targetCount !== undefined ? { targetCount: effect.targetCount } : {}),
      ...(effect.duration !== undefined ? { duration: effect.duration } : {}),
      ...(effect.forceSelfTargeting !== undefined
        ? { forceSelfTargeting: effect.forceSelfTargeting }
        : {}),
      ...(effect.realStartTime !== undefined ? { realStartTime: effect.realStartTime } : {}),
      ...(effect.skills ? { skills: effect.skills } : {}),
    })),
  };
}
