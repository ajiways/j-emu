import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { castTimedSpell, isTimedBuff } from "./timed-spell.ts";
import { stunTurns } from "./stun-turns.ts";

export type StunSource = Readonly<{
  artikulId: number;
  title: string;
  picture: string;
  spell: CombatSpell;
}>;

/** Stuns the target for the spell's turns and shows the stun icon on it (`effUse` kind 18). */
function applyStun(caster: Fighter, target: Fighter, source: StunSource): BattleEvent {
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
    ...(standing.remainTime !== undefined ? { remainTime: standing.remainTime } : {}),
    ...(standing.groupId !== undefined ? { groupId: standing.groupId } : {}),
  };
}

/**
 * Stun immunity as a share: the catalog writes `ANTI_STUN` as 100 (percent) on 45 spells and as 1
 * (a whole) on «Защита от оглушения» 7188; both mean full immunity.
 */
function stunImmunity(value: number): number {
  return value > 1 ? value / 100 : value;
}

/** One stunned turn lost; the stun icon goes with the last one. */
export function spendStunTurn(fighter: Fighter): readonly BattleEvent[] {
  if (fighter.stunnedTurns < 1) throw new Error("Fighter is not stunned");
  fighter.stunnedTurns -= 1;
  if (fighter.stunnedTurns > 0) return [];
  return fighter.effects.clearStun().map((effectId) => ({ type: "effect-purge", effectId }));
}

/**
 * A spell that stuns and also leaves a timed effect on the target (live: Сокрушение stuns for two
 * turns and, for 80 fight seconds, lets the target take only 60% damage).
 */
export function applyStunSpell(
  caster: Fighter,
  target: Fighter,
  source: StunSource & Readonly<{ flags: string | number }>,
  nowMs: number,
): readonly BattleEvent[] {
  const timed = source.spell.effects.filter(isTimedBuff);
  const lingering =
    timed.length === 0
      ? []
      : castTimedSpell(
          caster,
          target,
          { ...source, spell: { ...source.spell, effects: timed } },
          nowMs,
        );
  // ANTI_STUN: immune while it stands; the rest of the spell still lands.
  if (stunImmunity(target.effects.standingMax("ANTI_STUN")) >= 1) return lingering;
  return [...lingering, applyStun(caster, target, source)];
}
