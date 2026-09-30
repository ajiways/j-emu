import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { stunTurns } from "./stun-turns.ts";

export type StunSource = Readonly<{
  artikulId: number;
  title: string;
  picture: string;
  spell: CombatSpell;
}>;

/** Stuns the target for the spell's turns and shows the stun icon on it (`effUse` kind 18). */
export function applyStun(caster: Fighter, target: Fighter, source: StunSource): BattleEvent {
  const turns = stunTurns(source.spell, source.artikulId);
  target.stunnedTurns += turns;
  const standing = target.effects.attachStun({
    sourceId: caster.id,
    artikulId: source.artikulId,
    title: source.title,
    img: source.picture,
    remainTurns: turns,
    ...(source.spell.groupId !== undefined ? { groupId: source.spell.groupId } : {}),
  });
  return {
    type: "effect-use",
    artikulId: source.artikulId,
    animation: source.spell.animData ?? "",
    kind: 18,
    flags: "0",
    img: standing.img,
    title: standing.title,
    persId: target.id,
    dmgType: 0,
    id: standing.id,
    sourceId: standing.sourceId,
    remainTime: standing.remainTime,
    ...(standing.groupId !== undefined ? { groupId: standing.groupId } : {}),
  };
}

/** One stunned turn lost; the stun icon goes with the last one. */
export function spendStunTurn(fighter: Fighter): readonly BattleEvent[] {
  if (fighter.stunnedTurns < 1) throw new Error("Fighter is not stunned");
  fighter.stunnedTurns -= 1;
  if (fighter.stunnedTurns > 0) return [];
  return fighter.effects.clearStun().map((effectId) => ({ type: "effect-purge", effectId }));
}
