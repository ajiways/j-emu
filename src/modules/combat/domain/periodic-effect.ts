/**
 * Fight-clock state of one timed effect: kind-4/5 (DoT/HoT) ticks, kind-3 buffs only expire
 * (`periodSeconds` null). Age is real time plus the
 * `timeAdvance` jump of every action in its carrier's duel. Ticks fire when age crosses
 * `k * period`: on an action (at most one per effect, backlog waits for the next action) or,
 * strictly before expiry, on the real-time timer. Fit to the live trace pinned in
 * tests/fixtures/combat/live-periodic-effect-traces.ts.
 */
/** Timer wake-ups land on a threshold to the millisecond; float noise must not miss it. */
const CLOCK_EPSILON_SECONDS = 1e-6;

export type PeriodicState = {
  readonly durationSeconds: number;
  /** `null`: no ticks, the effect only ages and expires (a timed buff). */
  readonly periodSeconds: number | null;
  ageSeconds: number;
  ticksDone: number;
  syncedAtMs: number;
  /** The casting action was itself the turn-ending one: its own clock jump skips this effect. */
  skipNextJump: boolean;
};

export type PeriodicStep = Readonly<{ tick: boolean; expired: boolean }>;

export function startPeriodic(
  input: Readonly<{
    durationSeconds: number;
    periodSeconds: number | null;
    nowMs: number;
    castEndsTurn: boolean;
  }>,
): PeriodicState {
  requirePositiveInteger(input.durationSeconds, "Periodic effect duration");
  if (input.periodSeconds !== null)
    requirePositiveInteger(input.periodSeconds, "Periodic effect period");
  return {
    durationSeconds: input.durationSeconds,
    periodSeconds: input.periodSeconds,
    ageSeconds: 0,
    ticksDone: 0,
    syncedAtMs: input.nowMs,
    skipNextJump: input.castEndsTurn,
  };
}

export function remainingSeconds(state: PeriodicState, nowMs?: number): number {
  const real = nowMs === undefined ? 0 : realSecondsSince(state, nowMs);
  return Math.max(0, state.durationSeconds - state.ageSeconds - real);
}

/** One turn-ending action of the carrier's duel: real time since the last sync plus `jumpSeconds`. */
export function stepPeriodicOnAction(
  state: PeriodicState,
  nowMs: number,
  jumpSeconds: number,
): PeriodicStep {
  if (!(jumpSeconds >= 0)) throw new Error("Periodic effect jump must be non-negative");
  state.ageSeconds += realSecondsSince(state, nowMs) + (state.skipNextJump ? 0 : jumpSeconds);
  state.skipNextJump = false;
  state.syncedAtMs = nowMs;
  const reach = Math.min(state.ageSeconds, state.durationSeconds);
  const tick =
    state.periodSeconds !== null && state.ticksDone < Math.floor(reach / state.periodSeconds);
  if (tick) state.ticksDone += 1;
  return { tick, expired: state.ageSeconds >= state.durationSeconds };
}

/**
 * Real time up to `nowMs`. Every threshold crossed strictly before expiry is a tick, whether or
 * not the carrier stands in a duel; the expiry instant itself never ticks.
 */
export function stepPeriodicOnTimer(
  state: PeriodicState,
  nowMs: number,
): Readonly<{ ticks: number; expired: boolean }> {
  const before = state.ageSeconds;
  const after = before + realSecondsSince(state, nowMs);
  let ticks = 0;
  const period = state.periodSeconds;
  for (
    let k = period === null ? 0 : Math.max(state.ticksDone + 1, Math.floor(before / period) + 1);
    period !== null &&
    k * period < state.durationSeconds &&
    k * period <= after + CLOCK_EPSILON_SECONDS;
    k += 1
  ) {
    state.ticksDone += 1;
    ticks += 1;
  }
  state.ageSeconds = after;
  state.syncedAtMs = nowMs;
  return { ticks, expired: after + CLOCK_EPSILON_SECONDS >= state.durationSeconds };
}

/** Wall-clock time of the next threshold or expiry; the timer wakes there whoever is paired. */
export function nextPeriodicDueMs(state: PeriodicState): number {
  const expiryMs = state.syncedAtMs + (state.durationSeconds - state.ageSeconds) * 1000;
  const period = state.periodSeconds;
  if (period === null) return expiryMs;
  const k = Math.max(state.ticksDone + 1, Math.floor(state.ageSeconds / period) + 1);
  if (k * period >= state.durationSeconds) return expiryMs;
  const thresholdMs = state.syncedAtMs + (k * period - state.ageSeconds) * 1000;
  return Math.min(thresholdMs, expiryMs);
}

function realSecondsSince(state: PeriodicState, nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < state.syncedAtMs) {
    throw new Error("Periodic effect clock must not run backwards");
  }
  return (nowMs - state.syncedAtMs) / 1000;
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
}
