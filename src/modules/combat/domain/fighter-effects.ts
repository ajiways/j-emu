import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { bakeTimedStatPercents } from "./bake-timed-stat-percents.ts";
import type {
  ChargingKind3Input,
  StunEffectInput,
  TickEffectInput,
} from "./fighter-effect-inputs.ts";
import type { CombatGearSpell } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import {
  nextPeriodicDueMs,
  remainingSeconds,
  startPeriodic,
  stepPeriodicOnAction,
  stepPeriodicOnTimer,
  type PeriodicState,
} from "./periodic-effect.ts";

const TURN_SECONDS = 40;

export type FightTickPulse = Readonly<{
  effectId: number;
  kind: number;
  sourceId: number;
  dmgType: number;
  amount?: number | string;
  catalogPcStr: number;
  catalogStr: number;
  casterStrength: number;
  casterMagPower: number;
  casterMagResist: number;
}>;

/** What one clock step did to the effects: a tick to apply, or an effect that ran out. */
export type PeriodicItem =
  | Readonly<{ kind: "tick"; pulse: FightTickPulse }>
  | Readonly<{ kind: "expire"; effectId: number }>;

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
  periodic?: PeriodicState;
  tickAmount?: number | string;
  catalogPcStr?: number;
  catalogStr?: number;
  casterStrength?: number;
  casterMagPower?: number;
  casterMagResist?: number;
  charging?: boolean;
  stun?: boolean;
};

export class FighterEffects {
  readonly effectIds: FightEffectIds;
  private readonly standing: StandingEffect[] = [];

  constructor(
    input: Readonly<{
      heroId: number;
      strength: number;
      startedAtMs: number;
      gearSpells: readonly CombatGearSpell[];
      effectIds: FightEffectIds;
    }>,
  ) {
    requireWireIdentity(input.heroId, "hero id");
    if (!Number.isInteger(input.startedAtMs) || input.startedAtMs < 0) {
      throw new Error("Gear-spell attach clock must be a non-negative integer");
    }
    this.effectIds = input.effectIds;
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

  /** With `nowMs` a periodic effect reports the time left at that instant, not at its last step. */
  snapshot(nowMs?: number): readonly FightEffectSnap[] {
    return this.standing.map((fx) => ({
      id: fx.id,
      kind: fx.kind,
      sourceId: fx.sourceId,
      artikulId: fx.artikulId,
      title: fx.title,
      img: fx.img,
      dmgType: fx.dmgType,
      remainTime: fx.periodic
        ? Math.ceil(remainingSeconds(fx.periodic, nowMs))
        : fx.remainTurns * TURN_SECONDS,
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
      if (fx.periodic || fx.charging || fx.stun) {
        keep.push(fx);
        continue;
      }
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

  consumeChargingHit(): readonly number[] {
    const purged: number[] = [];
    const keep: StandingEffect[] = [];
    for (const fx of this.standing) {
      if (!fx.charging) {
        keep.push(fx);
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

  /** Real time up to `nowMs`; only a fighter in a duel ticks, expiry is silent otherwise. */
  advanceOnTimer(nowMs: number, inDuel: boolean): readonly PeriodicItem[] {
    return this.stepPeriodic((state) => stepPeriodicOnTimer(state, nowMs, inDuel));
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
      id: this.effectIds.take(),
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
  }
}
