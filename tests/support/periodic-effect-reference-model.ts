import type {
  ExpectedTick,
  TraceEffect,
  TraceStep,
} from "../fixtures/combat/live-periodic-effect-traces.ts";

export type SimulatedTick = ExpectedTick;
export type SimulatedExpiry = Readonly<{ effect: string; at: number }>;

type Effect = {
  name: string;
  def: TraceEffect;
  carrier: string;
  age: number;
  ticksDone: number;
  expired: boolean;
  syncedAt: number;
};

/**
 * Reference model fitted to the live trace: effect age is real time plus the action's
 * `timeAdvance` jump; a carrier ticks only while it is in a duel, at most one tick per action
 * (backlog waits for the next one), and a timer tick never lands on the expiry instant.
 */
export class PeriodicEffectReferenceModel {
  readonly ticks: SimulatedTick[] = [];
  readonly expiries: SimulatedExpiry[] = [];
  private readonly effects: Effect[] = [];
  private readonly duel = new Map<string, string>();

  constructor(private readonly defs: Readonly<Record<string, TraceEffect>>) {}

  run(steps: readonly TraceStep[]): void {
    for (const step of steps) this.step(step);
  }

  remainTime(effect: string, at: number): number {
    const found = this.effects.find((entry) => entry.name === effect);
    if (!found) throw new Error(`Effect ${effect} was never cast`);
    return found.def.duration - (found.age + (at - found.syncedAt));
  }

  private step(step: TraceStep): void {
    for (const effect of this.effects) this.advanceReal(effect, step.t);
    if (step.type === "pair") {
      for (const id of [step.a, step.b]) {
        const previous = this.duel.get(id);
        this.duel.delete(id);
        if (previous !== undefined) this.duel.delete(previous);
      }
      this.duel.set(step.a, step.b);
      this.duel.set(step.b, step.a);
      return;
    }
    if (step.type === "cast") {
      const def = this.defs[step.effect];
      if (!def) throw new Error(`Effect ${step.effect} is not defined`);
      this.effects.push({
        name: step.effect,
        def,
        carrier: step.carrier,
        age: 0,
        ticksDone: 0,
        expired: false,
        syncedAt: step.t,
      });
      return;
    }
    const inDuel = new Set([step.actor, this.duel.get(step.actor)]);
    for (const effect of this.effects) {
      if (effect.expired || !inDuel.has(effect.carrier)) continue;
      effect.age += step.ta;
      if (step.kills === effect.carrier) {
        effect.expired = true;
        continue;
      }
      this.tickByAction(effect, step.t);
    }
  }

  private tickByAction(effect: Effect, at: number): void {
    const reach = Math.min(effect.age, effect.def.duration);
    if (effect.ticksDone < Math.floor(reach / effect.def.period)) {
      effect.ticksDone += 1;
      this.ticks.push({ effect: effect.name, k: effect.ticksDone, via: "action", at });
    }
    if (effect.age >= effect.def.duration) this.expire(effect, at);
  }

  private advanceReal(effect: Effect, to: number): void {
    if (effect.expired) return;
    const from = effect.syncedAt;
    const period = effect.def.period;
    const inDuel = this.duel.has(effect.carrier);
    for (let k = effect.ticksDone + 1; k * period < effect.def.duration; k += 1) {
      const dueAt = from + (k * period - effect.age);
      if (dueAt > to) break;
      if (dueAt < from || !inDuel) continue;
      effect.ticksDone = k;
      this.ticks.push({ effect: effect.name, k, via: "timer", at: dueAt });
    }
    effect.age += to - from;
    effect.syncedAt = to;
    if (effect.age >= effect.def.duration) {
      this.expire(effect, to - (effect.age - effect.def.duration));
    }
  }

  private expire(effect: Effect, at: number): void {
    effect.expired = true;
    this.expiries.push({ effect: effect.name, at });
  }
}
