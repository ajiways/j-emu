import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { bakeTimedStatPercents } from "./bake-timed-stat-percents.ts";
import type { CombatGearSpell } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";

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
  last: boolean;
}>;

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
  ticksLeft?: number;
  tickAmount?: number | string;
  catalogPcStr?: number;
  catalogStr?: number;
  casterStrength?: number;
  casterMagPower?: number;
  casterMagResist?: number;
  charging?: boolean;
};

export class HuntHumanFightEffects {
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
      if (fx.kind === 4 || fx.kind === 5 || fx.charging) {
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

  takeTickPulses(): readonly FightTickPulse[] {
    const pulses: FightTickPulse[] = [];
    const keep: StandingEffect[] = [];
    for (const fx of this.standing) {
      if (fx.kind !== 4 && fx.kind !== 5) {
        keep.push(fx);
        continue;
      }
      if (fx.ticksLeft === undefined) {
        throw new Error(`Tick effect ${fx.id} ticksLeft is required`);
      }
      if (
        fx.casterStrength === undefined ||
        fx.casterMagPower === undefined ||
        fx.casterMagResist === undefined ||
        fx.catalogPcStr === undefined ||
        fx.catalogStr === undefined
      ) {
        throw new Error(`Tick effect ${fx.id} caster snapshot is required`);
      }
      const left = fx.ticksLeft;
      if (left < 1) continue;
      const next = left - 1;
      pulses.push({
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
        last: next < 1,
      });
      fx.ticksLeft = next;
      fx.remainTurns = next;
      if (next > 0) keep.push(fx);
    }
    this.standing.length = 0;
    this.standing.push(...keep);
    return pulses;
  }

  attachChargingKind3(
    input: Readonly<{
      sourceId: number;
      artikulId: number;
      title: string;
      img: string;
      dmgType: number;
      remainTurns: number;
      groupId?: number;
    }>,
  ): FightEffectSnap {
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

  attachTick(
    input: Readonly<{
      kind: 4 | 5;
      sourceId: number;
      artikulId: number;
      title: string;
      img: string;
      dmgType: number;
      groupId?: number;
      ticks: number;
      amount?: number | string;
      catalogPcStr: number;
      catalogStr: number;
      casterStrength: number;
      casterMagPower: number;
      casterMagResist: number;
    }>,
  ): FightEffectSnap {
    if (!input.title) throw new Error(`Tick effect ${input.artikulId} title is required`);
    if (!input.img) throw new Error(`Tick effect ${input.artikulId} img is required`);
    if (!Number.isInteger(input.ticks) || input.ticks < 1) {
      throw new Error(`Tick effect ${input.artikulId} ticks must be a positive integer`);
    }
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
      remainTurns: input.ticks,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      ticksLeft: input.ticks,
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
