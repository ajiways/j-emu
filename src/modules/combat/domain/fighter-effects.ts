import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { takeOverlayCharge, takeStrikeCharges } from "./strike-charges.ts";
import type { SpentStrike } from "./strike-mods.ts";
import { addDrain, drainFromSkills, NO_DRAIN, type Drain } from "./drain.ts";
import { takenDamage } from "./damage-intake.ts";
import { absorbIntoShields, NO_HIT_SHIELD, type HitShield } from "./shield-pool.ts";
import type { StatBase } from "./skill-bake.ts";
import { timedBuffEffect, type TimedBuffInput } from "./timed-buff.ts";
import type {
  ChargingKind3Input,
  ShieldEffectInput,
  StunEffectInput,
  TickEffectInput,
} from "./fighter-effect-inputs.ts";
import type { CombatGearSpell } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import {
  snapOf,
  type FightEffectSnap,
  type FightTickPulse,
  type PeriodicItem,
  type StandingEffect,
} from "./standing-effect.ts";
import {
  nextPeriodicDueMs,
  startPeriodic,
  stepPeriodicOnAction,
  stepPeriodicOnTimer,
  type PeriodicState,
} from "./periodic-effect.ts";

export class FighterEffects {
  readonly effectIds: FightEffectIds;
  private readonly base: StatBase;
  private readonly standing: StandingEffect[] = [];
  /** What the shields did to the damage the last `takenDamage` call worked out. */
  private hitShield: HitShield = NO_HIT_SHIELD;

  constructor(
    input: Readonly<{
      heroId: number;
      base: StatBase;
      startedAtMs: number;
      gearSpells: readonly CombatGearSpell[];
      effectIds: FightEffectIds;
    }>,
  ) {
    requireWireIdentity(input.heroId, "hero id");
    if (!Number.isInteger(input.startedAtMs) || input.startedAtMs < 0) {
      throw new Error("Gear-spell attach clock must be a non-negative integer");
    }
    this.base = input.base;
    this.effectIds = input.effectIds;
    for (const gear of input.gearSpells) {
      for (const effect of gear.spell.effects) {
        this.attach(input, gear, effect);
      }
    }
  }

  /** The sum of one baked flat skill over everything standing on the fighter. */
  standingSkill(skillId: string): number {
    let total = 0;
    for (const fx of this.standing) total += fx.skills[skillId] ?? 0;
    return total;
  }

  /** The largest value of a rate skill (DR, BR, CR, ANTI_STUN) over the timed effects standing on the fighter. */
  standingMax(skillId: string): number {
    let best = 0;
    for (const fx of this.standing) {
      if (!fx.charging) best = Math.max(best, fx.skills[skillId] ?? 0);
    }
    return best;
  }

  /** `VAMP` and `ANTIVAMP` of the timed effects standing on the fighter. */
  standingDrain(): Drain {
    let total = NO_DRAIN;
    for (const fx of this.standing) {
      if (!fx.charging)
        total = addDrain(
          total,
          drainFromSkills((id) => fx.skills[id] ?? 0),
        );
    }
    return total;
  }

  /**
   * What the damage `raw` of `dmgType` becomes under the effects standing on this fighter, shields
   * included; what they took of it is read with `takeHitShield` by whoever shows the hit.
   */
  takenDamage(raw: number, dmgType: number): number {
    const taken = takenDamage(this.standing, raw, dmgType);
    const { passed, hit } = absorbIntoShields(this.standing, taken, dmgType);
    this.hitShield = hit;
    return passed;
  }

  /** The shield part of the last hit worked out here; reading it clears it. */
  takeHitShield(): HitShield {
    const hit = this.hitShield;
    this.hitShield = NO_HIT_SHIELD;
    return hit;
  }

  /** A shield (`kind 9`) that stands until it is spent; the icon of it goes with `effUse`. */
  attachShield(input: ShieldEffectInput): FightEffectSnap {
    requireWireIdentity(input.sourceId, "shield source id");
    requireWireIdentity(input.artikulId, "shield artikul id");
    if (!input.title) throw new Error(`Shield ${input.artikulId} title is required`);
    if (!input.img) throw new Error(`Shield ${input.artikulId} img is required`);
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new Error(`Shield ${input.artikulId} capacity must be a positive integer`);
    }
    if (input.limitPct < 1 || input.limitPct > 100) {
      throw new Error(`Shield ${input.artikulId} limit must be a share of 1..100 percent`);
    }
    const id = this.effectIds.take();
    this.standing.push({
      id,
      kind: 9,
      sourceId: input.sourceId,
      artikulId: input.artikulId,
      title: input.title,
      img: input.img,
      dmgType: input.dmgType,
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      skills: {},
      remainTurns: 0,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      fightLong: true,
      shield: { remaining: input.capacity, mask: input.mask, limitPct: input.limitPct },
    });
    const snap = this.snapshot().find((fx) => fx.id === id);
    if (!snap) throw new Error(`Shield ${id} did not snapshot`);
    return snap;
  }

  /** A kind-3 buff that lives on the fight clock (or the whole fight); baked against the fighter's stats. */
  attachTimedBuff(input: Omit<TimedBuffInput, "base">): FightEffectSnap {
    const fx = timedBuffEffect(this.effectIds.take(), { ...input, base: this.base });
    this.standing.push(fx);
    return snapOf(fx);
  }

  /** With `nowMs` a periodic effect reports the time left at that instant, not at its last step. */
  snapshot(nowMs?: number): readonly FightEffectSnap[] {
    return this.standing.map((fx) => snapOf(fx, nowMs));
  }

  /** One physical swing: spends a charge of every swing-changing charged effect. */
  takeStrike(): SpentStrike {
    return takeStrikeCharges(this.standing);
  }

  /** The school float that rides on a swing that landed; see `takeOverlayCharge`. */
  takeOverlay(): ReturnType<typeof takeOverlayCharge> {
    return takeOverlayCharge(this.standing);
  }

  standingGroups(): readonly number[] {
    const groups: number[] = [];
    for (const fx of this.standing) {
      if (fx.groupId !== undefined) groups.push(fx.groupId);
    }
    return groups;
  }

  dispelGroups(groups: readonly number[]): readonly number[] {
    if (groups.length < 1) return [];
    const wanted = new Set(groups);
    const purged: number[] = [];
    const keep: StandingEffect[] = [];
    for (const fx of this.standing) {
      if (fx.groupId !== undefined && wanted.has(fx.groupId)) {
        purged.push(fx.id);
        continue;
      }
      keep.push(fx);
    }
    this.standing.length = 0;
    this.standing.push(...keep);
    return purged;
  }

  /** A turn-ending action in this fighter's duel: real time plus the action's clock jump. */
  advanceOnAction(nowMs: number, jumpSeconds: number): readonly PeriodicItem[] {
    return this.stepPeriodic((state) => {
      const step = stepPeriodicOnAction(state, nowMs, jumpSeconds);
      return { ticks: step.tick ? 1 : 0, expired: step.expired };
    });
  }

  /** Real time up to `nowMs`: effects tick on the fight clock wherever their carrier stands. */
  advanceOnTimer(nowMs: number): readonly PeriodicItem[] {
    return this.stepPeriodic((state) => stepPeriodicOnTimer(state, nowMs));
  }

  nextPeriodicDueMs(): number | null {
    let due: number | null = null;
    for (const fx of this.standing) {
      if (!fx.periodic) continue;
      const at = nextPeriodicDueMs(fx.periodic);
      if (due === null || at < due) due = at;
    }
    return due;
  }

  private stepPeriodic(
    step: (state: PeriodicState) => Readonly<{ ticks: number; expired: boolean }>,
  ): readonly PeriodicItem[] {
    const items: PeriodicItem[] = [];
    const keep: StandingEffect[] = [];
    for (const fx of this.standing) {
      if (!fx.periodic) {
        keep.push(fx);
        continue;
      }
      const result = step(fx.periodic);
      for (let index = 0; index < result.ticks; index += 1) {
        items.push({ kind: "tick", pulse: this.pulseOf(fx) });
      }
      if (result.expired) items.push({ kind: "expire", effectId: fx.id });
      else keep.push(fx);
    }
    this.standing.length = 0;
    this.standing.push(...keep);
    return items;
  }

  private pulseOf(fx: StandingEffect): FightTickPulse {
    if (
      fx.casterStrength === undefined ||
      fx.casterMagPower === undefined ||
      fx.casterMagResist === undefined ||
      fx.catalogPcStr === undefined ||
      fx.catalogStr === undefined
    ) {
      throw new Error(`Tick effect ${fx.id} caster snapshot is required`);
    }
    return {
      effectId: fx.id,
      kind: fx.kind,
      sourceId: fx.sourceId,
      dmgType: fx.dmgType,
      ...(fx.tickAmount !== undefined ? { amount: fx.tickAmount } : {}),
      catalogPcStr: fx.catalogPcStr,
      catalogStr: fx.catalogStr,
      casterStrength: fx.casterStrength,
      casterMagPower: fx.casterMagPower,
      casterMagResist: fx.casterMagResist,
    };
  }

  attachChargingKind3(input: ChargingKind3Input): FightEffectSnap {
    requireWireIdentity(input.sourceId, "charging kind-3 source id");
    requireWireIdentity(input.artikulId, "charging kind-3 artikul id");
    if (!input.title) throw new Error("Charging kind-3 title is required");
    if (!input.img) throw new Error("Charging kind-3 img is required");
    if (!Number.isInteger(input.dmgType) || input.dmgType < 0) {
      throw new Error("Charging kind-3 dmgType must be a non-negative integer");
    }
    if (!Number.isInteger(input.remainTurns) || input.remainTurns < 1) {
      throw new Error("Charging kind-3 remainTurns must be a positive integer");
    }
    const id = this.effectIds.take();
    this.standing.push({
      id,
      kind: 3,
      sourceId: input.sourceId,
      artikulId: input.artikulId,
      title: input.title,
      img: input.img,
      dmgType: input.dmgType,
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      skills: {},
      remainTurns: input.remainTurns,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      charging: true,
      strike: input.strike,
    });
    const snap = this.snapshot().find((fx) => fx.id === id);
    if (!snap) throw new Error(`Charging kind-3 ${id} did not snapshot`);
    return snap;
  }

  /** The icon of a stun on its carrier; it stays until the stunned turns are spent. */
  attachStun(input: StunEffectInput): FightEffectSnap {
    requireWireIdentity(input.sourceId, "stun source id");
    requireWireIdentity(input.artikulId, "stun artikul id");
    if (!input.title) throw new Error("Stun title is required");
    if (!input.img) throw new Error("Stun img is required");
    if (!Number.isInteger(input.remainTurns) || input.remainTurns < 1) {
      throw new Error("Stun remainTurns must be a positive integer");
    }
    const id = this.effectIds.take();
    this.standing.push({
      id,
      kind: 18,
      sourceId: input.sourceId,
      artikulId: input.artikulId,
      title: input.title,
      img: input.img,
      dmgType: 0,
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      skills: {},
      remainTurns: input.remainTurns,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      stun: true,
    });
    const snap = this.snapshot().find((fx) => fx.id === id);
    if (!snap) throw new Error(`Stun ${id} did not snapshot`);
    return snap;
  }

  /** Removes the stun icons; the ids to `effPurge`. */
  clearStun(): readonly number[] {
    const cleared = this.standing.filter((fx) => fx.stun).map((fx) => fx.id);
    const keep = this.standing.filter((fx) => !fx.stun);
    this.standing.length = 0;
    this.standing.push(...keep);
    return cleared;
  }

  attachTick(input: TickEffectInput): FightEffectSnap {
    if (!input.title) throw new Error(`Tick effect ${input.artikulId} title is required`);
    if (!input.img) throw new Error(`Tick effect ${input.artikulId} img is required`);
    const id = this.effectIds.take();
    this.standing.push({
      id,
      kind: input.kind,
      sourceId: input.sourceId,
      artikulId: input.artikulId,
      title: input.title,
      img: input.img,
      dmgType: input.dmgType,
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      skills: {},
      remainTurns: 0,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      periodic: startPeriodic(input),
      ...(input.amount !== undefined ? { tickAmount: input.amount } : {}),
      catalogPcStr: input.catalogPcStr,
      catalogStr: input.catalogStr,
      casterStrength: input.casterStrength,
      casterMagPower: input.casterMagPower,
      casterMagResist: input.casterMagResist,
    });
    const snap = this.snapshot().find((fx) => fx.id === id);
    if (!snap) throw new Error(`Tick effect ${id} did not snapshot`);
    return snap;
  }

  private attach(
    input: Readonly<{ heroId: number; startedAtMs: number }>,
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
    this.attachTimedBuff({
      sourceId: input.heroId,
      artikulId: gear.artikulId,
      title: gear.title,
      img: gear.picture,
      dmgType: effect.dmgType === undefined ? 0 : effect.dmgType,
      ...(gear.spell.groupId !== undefined ? { groupId: gear.spell.groupId } : {}),
      skills: effect.skills ?? [],
      durationSeconds: effect.duration,
      nowMs: input.startedAtMs,
      castEndsTurn: false,
    });
  }
}
