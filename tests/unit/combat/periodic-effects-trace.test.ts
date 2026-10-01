import { unitStatBase } from "../../support/stat-base.ts";
import { describe, expect, it } from "vitest";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import type { PeriodicItem } from "../../../src/modules/combat/domain/standing-effect.ts";
import {
  EXPECTED_REMAIN_TIME,
  EXPECTED_TICKS,
  TRACE_EFFECTS,
  TRACE_STEPS,
  type TraceStep,
} from "../../fixtures/combat/live-periodic-effect-traces.ts";

const POLL_JITTER_SECONDS = 1;
const ids = ["hero", "e838", "e926"] as const;

type Seen = { effect: string; k: number; at: number };

/** Drives the production effects the way the fight loop does: one battle timer plus actions. */
class TraceRun {
  readonly ticks: Seen[] = [];
  readonly expiries: { effect: string; at: number }[] = [];
  private readonly effectIds = new FightEffectIds();
  private readonly fighters = new Map<string, FighterEffects>();
  private readonly names = new Map<number, string>();
  private readonly tickCounts = new Map<string, number>();
  private readonly duel = new Map<string, string>();
  private now = 0;

  constructor(steps: readonly TraceStep[]) {
    let heroId = 1;
    for (const id of ids) {
      this.fighters.set(
        id,
        new FighterEffects({
          heroId: heroId++,
          base: unitStatBase(10),
          startedAtMs: 0,
          gearSpells: [],
          effectIds: this.effectIds,
        }),
      );
    }
    for (const step of steps) this.step(step);
  }

  remain(effect: string, atSeconds: number): number {
    const nowMs = Math.round(atSeconds * 1000);
    for (const fx of this.fighters.values()) {
      const found = fx.snapshot(nowMs).find((snap) => this.names.get(snap.id) === effect);
      if (found?.remainTime !== undefined) return found.remainTime;
    }
    throw new Error(`Effect ${effect} is gone`);
  }

  private step(step: TraceStep): void {
    this.runTimersUntil(step.t);
    this.now = Math.round(step.t * 1000);
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
      const def = TRACE_EFFECTS[step.effect];
      const carrier = this.fighters.get(step.carrier);
      if (!def || !carrier) throw new Error(`Unknown effect or carrier in ${step.effect}`);
      const snap = carrier.attachTick({
        kind: def.kind,
        sourceId: 1,
        artikulId: 447,
        title: step.effect,
        img: "x.png",
        dmgType: 0,
        durationSeconds: def.duration,
        periodSeconds: def.period,
        nowMs: this.now,
        castEndsTurn: false,
        catalogPcStr: 0,
        catalogStr: 0,
        casterStrength: 10,
        casterMagPower: 0,
        casterMagResist: 0,
      });
      this.names.set(snap.id, step.effect);
      return;
    }
    const partner = this.duel.get(step.actor);
    for (const id of [step.actor, partner]) {
      if (id === undefined || id === step.kills) continue;
      this.collect(this.fighters.get(id)?.advanceOnAction(this.now, step.ta) ?? [], step.t);
    }
  }

  private runTimersUntil(untilSeconds: number): void {
    const untilMs = Math.round(untilSeconds * 1000);
    for (;;) {
      let due: number | null = null;
      for (const fx of this.fighters.values()) {
        const at = fx.nextPeriodicDueMs();
        if (at !== null && (due === null || at < due)) due = at;
      }
      if (due === null || due > untilMs) return;
      for (const [id, fx] of this.fighters) {
        // The effect ticks wherever its carrier stands; the client sees the ticks of its own duel.
        this.collect(fx.advanceOnTimer(due), due / 1000, this.duel.has(id));
      }
    }
  }

  private collect(items: readonly PeriodicItem[], at: number, seen = true): void {
    for (const item of items) {
      if (item.kind === "expire") {
        this.expiries.push({ effect: this.names.get(item.effectId) ?? "?", at });
        continue;
      }
      if (!seen) continue;
      const effect = this.names.get(item.pulse.effectId) ?? "?";
      const k = (this.tickCounts.get(effect) ?? 0) + 1;
      this.tickCounts.set(effect, k);
      this.ticks.push({ effect, k, at });
    }
  }
}

describe("production periodic effects against the live trace", () => {
  const run = new TraceRun(TRACE_STEPS);

  it("ticks the way the client saw, within poll jitter", () => {
    const shape = (tick: { effect: string; k: number }) => `${tick.effect}#${tick.k}`;
    expect(run.ticks.map(shape).sort()).toEqual(EXPECTED_TICKS.map(shape).sort());
    for (const expected of EXPECTED_TICKS) {
      const got = run.ticks.find((tick) => shape(tick) === shape(expected));
      expect(Math.abs((got?.at ?? Infinity) - expected.at), shape(expected)).toBeLessThanOrEqual(
        POLL_JITTER_SECONDS,
      );
    }
  });

  it("expires effects where the client purged them and lets the unpaired DoT lapse", () => {
    const at = (effect: string) => run.expiries.find((entry) => entry.effect === effect)?.at;
    expect(at("hot283First")).toBeLessThanOrEqual(29.2);
    expect(Math.abs((at("hot283Second") ?? Infinity) - 69.5)).toBeLessThanOrEqual(
      POLL_JITTER_SECONDS,
    );
    expect(at("dot447OnE838")).toBeLessThan(59.5);
  });

  it("keeps its remaining time near the live persEff values when stopped mid-fight", () => {
    for (const expected of EXPECTED_REMAIN_TIME) {
      const partial = new TraceRun(TRACE_STEPS.filter((step) => step.t <= expected.at));
      expect(
        Math.abs(partial.remain(expected.effect, expected.at) - expected.remain),
        `at ${expected.at}`,
      ).toBeLessThan(POLL_JITTER_SECONDS);
    }
  });
});
