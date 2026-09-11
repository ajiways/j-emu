import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { bakeTimedStatPercents } from "./bake-timed-stat-percents.ts";
import type { CombatGearSpell } from "./combat-loadout.ts";

const TURN_SECONDS = 40;

export type FightEffectSnap = Readonly<{
  id: number;
  kind: number;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  remainTime: number;
  groupId?: number;
  skills: Readonly<Record<string, number>>;
}>;

type StandingEffect = {
  id: number;
  kind: number;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  groupId?: number;
  skills: Readonly<Record<string, number>>;
  remainTurns: number;
  expiresAtMs: number;
};

export class HuntHumanFightEffects {
  private nextId = 1;
  private readonly standing: StandingEffect[] = [];

  constructor(
    input: Readonly<{
      heroId: number;
      strength: number;
      startedAtMs: number;
      gearSpells: readonly CombatGearSpell[];
    }>,
  ) {
    requireWireIdentity(input.heroId, "hero id");
    if (!Number.isInteger(input.startedAtMs) || input.startedAtMs < 0) {
      throw new Error("Gear-spell attach clock must be a non-negative integer");
    }
    for (const gear of input.gearSpells) {
      for (const effect of gear.spell.effects) {
        this.attach(input, gear, effect);
      }
    }
  }

  standingStrength(): number {
    let bonus = 0;
    for (const fx of this.standing) {
      const str = fx.skills.STR;
      if (str !== undefined) bonus += str;
    }
    return bonus;
  }

  snapshot(): readonly FightEffectSnap[] {
    return this.standing.map((fx) => ({
      id: fx.id,
      kind: fx.kind,
      sourceId: fx.sourceId,
      artikulId: fx.artikulId,
      title: fx.title,
      img: fx.img,
      dmgType: fx.dmgType,
      remainTime: fx.remainTurns * TURN_SECONDS,
      ...(fx.groupId !== undefined ? { groupId: fx.groupId } : {}),
      skills: fx.skills,
    }));
  }

  onActorEndingTurn(nowMs: number): readonly number[] {
    if (!Number.isInteger(nowMs) || nowMs < 0) {
      throw new Error("Gear-spell expire clock must be a non-negative integer");
    }
    const purged: number[] = [];
    const keep: StandingEffect[] = [];
    for (const fx of this.standing) {
      if (nowMs >= fx.expiresAtMs) {
        purged.push(fx.id);
        continue;
      }
      fx.remainTurns -= 1;
      if (fx.remainTurns <= 0) {
        purged.push(fx.id);
        continue;
      }
      keep.push(fx);
    }
    this.standing.length = 0;
    this.standing.push(...keep);
    return purged;
  }

  private attach(
    input: Readonly<{ heroId: number; strength: number; startedAtMs: number }>,
    gear: CombatGearSpell,
    effect: CombatGearSpell["spell"]["effects"][number],
  ): void {
    if (effect.kind !== 3) {
      throw new Error(`Gear spell ${gear.artikulId} kind must be 3`);
    }
    if (effect.duration === undefined) {
      throw new Error(`Gear spell ${gear.artikulId} duration is required`);
    }
    if (gear.spell.triggers !== undefined) {
      throw new Error(`Gear spell ${gear.artikulId} must not have triggers`);
    }
    if (gear.spell.onlyPvP !== undefined) {
      throw new Error(`Gear spell ${gear.artikulId} must not have onlyPvP`);
    }
    this.standing.push({
      id: this.nextId,
      kind: 3,
      sourceId: input.heroId,
      artikulId: gear.artikulId,
      title: gear.title,
      img: gear.picture,
      dmgType: effect.dmgType === undefined ? 0 : effect.dmgType,
      ...(gear.spell.groupId !== undefined ? { groupId: gear.spell.groupId } : {}),
      skills: bakeTimedStatPercents(input.strength, effect.skills ?? []),
      remainTurns: Math.max(1, Math.round(effect.duration / TURN_SECONDS)),
      expiresAtMs: input.startedAtMs + effect.duration * 1000,
    });
    this.nextId += 1;
  }
}
