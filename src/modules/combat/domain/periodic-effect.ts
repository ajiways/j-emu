/**
 * Fight-clock state of one kind-4/5 (DoT/HoT) effect. Age is real time plus the
 * `timeAdvance` jump of every action in its carrier's duel. Ticks fire when age crosses
 * `k * period`: on an action (at most one per effect, backlog waits for the next action) or,
 * strictly before expiry, on the real-time timer. Fit to the live trace pinned in
 * tests/fixtures/combat/live-periodic-effect-traces.ts.
 */
/** Timer wake-ups land on a threshold to the millisecond; float noise must not miss it. */
const CLOCK_EPSILON_SECONDS = 1e-6;

export type PeriodicState = {
  readonly durationSeconds: number;
  readonly periodSeconds: number;
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
    periodSeconds: number;
    nowMs: number;
    castEndsTurn: boolean;
  }>,
): PeriodicState {
  requirePositiveInteger(input.durationSeconds, "Periodic effect duration");
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
  const tick = state.ticksDone < Math.floor(reach / state.periodSeconds);
  if (tick) state.ticksDone += 1;
  return { tick, expired: state.ageSeconds >= state.durationSeconds };
}

/**
 * Real time up to `nowMs`. Every threshold crossed strictly before expiry is a tick while the
 * carrier is in a duel and is skipped otherwise; the expiry instant itself never ticks.
 */
export function stepPeriodicOnTimer(
  state: PeriodicState,
  nowMs: number,
  inDuel: boolean,
): Readonly<{ ticks: number; expired: boolean }> {
  const before = state.ageSeconds;
  const after = before + realSecondsSince(state, nowMs);
  let ticks = 0;
  for (
    let k = Math.max(state.ticksDone + 1, Math.floor(before / state.periodSeconds) + 1);
    k * state.periodSeconds < state.durationSeconds &&
    k * state.periodSeconds <= after + CLOCK_EPSILON_SECONDS;
    k += 1
  ) {
    if (!inDuel) continue;
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
  const k = Math.max(state.ticksDone + 1, Math.floor(state.ageSeconds / state.periodSeconds) + 1);
  if (k * state.periodSeconds >= state.durationSeconds) return expiryMs;
  const thresholdMs = state.syncedAtMs + (k * state.periodSeconds - state.ageSeconds) * 1000;
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
