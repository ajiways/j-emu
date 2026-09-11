export type FarmRng = Readonly<{ unit(): number }>;
export type FarmOutcome = "success" | "failure" | "attacked";
export type FarmCollectionOutcome = Exclude<FarmOutcome, "attacked">;

export const STARTER_MASTERY = 1;
const DEFAULT_FARM_TIME_SEC = 60;
const DEFAULT_STAMINA_DRAIN = 4;
const STAMINA_REGEN_PER_SEC = 1 / 60;
const SLOT_GOLD = [10, 2000, 7500] as const;
export const FARM_SWEEP_CATCHUP_MS = 2_000;

const FARM_ATTACKED_BASE = 0.01;
const FARM_ATTACKED_FLOOR = 0.0008;
const FARM_ATTACKED_DECAY = 0.55;
const FARM_SUCCESS_MISMATCH = 0.65;

const TRAIN_EASY_RATIO = 40 / 59;
const TRAIN_MID_RATIO = 50 / 59;
const TRAIN_EASY_CHANCE = 0.98;
const TRAIN_MID_CHANCE = 0.42;
const TRAIN_LATE_CHANCE = 0.07;
const TRAIN_INTELLECT_MID = 0.08;
const TRAIN_INTELLECT_LATE = 0.04;

function effectiveGremlinMastery(masteryValue: number): number {
  return Math.max(STARTER_MASTERY, Math.floor(masteryValue));
}

export function masteryAllowsFarm(gremlinMastery: number, farmMasteryRequired: number): boolean {
  return effectiveGremlinMastery(gremlinMastery) >= Math.max(0, Math.floor(farmMasteryRequired));
}

export function farmDurationSec(farmTime: number, speed: number): number {
  const base = farmTime > 0 ? farmTime : DEFAULT_FARM_TIME_SEC;
  const spd = Math.max(0, Math.floor(speed));
  return Math.max(1, base - Math.max(0, spd - 1));
}

export function appropriateTactics(climate: number): number {
  return (mod3(climate) + 1) % 3;
}

function mod3(n: number): number {
  const v = Math.floor(n) % 3;
  return v < 0 ? v + 3 : v;
}

function farmAttackChance(defence: number): number {
  const d = Math.max(0, defence);
  return (
    FARM_ATTACKED_FLOOR + (FARM_ATTACKED_BASE - FARM_ATTACKED_FLOOR) * FARM_ATTACKED_DECAY ** d
  );
}

export function farmCycle(opts: { tacticMatch: boolean }, rng: FarmRng): FarmCollectionOutcome {
  if (opts.tacticMatch) return "success";
  if (rng.unit() < FARM_SUCCESS_MISMATCH) return "success";
  return "failure";
}

export function farmAttackAt(stime: number, ftime: number, defence: number, rng: FarmRng): number {
  const duration = Math.max(0, Math.floor(ftime) - Math.floor(stime));
  if (duration <= 1) return 0;
  const chancePerMinute = farmAttackChance(defence);
  const hazardPerSecond = -Math.log1p(-chancePerMinute) / 60;
  const u = Math.min(1 - Number.EPSILON, Math.max(0, rng.unit()));
  const waitSeconds = Math.max(1, Math.ceil(-Math.log1p(-u) / hazardPerSecond));
  return waitSeconds < duration ? Math.floor(stime) + waitSeconds : 0;
}

function skillTrainChance(current: number, cap: number, intellect = 0): number {
  const cur = Math.max(0, current);
  const max = Math.max(0, Math.floor(cap));
  if (max <= 0 || cur >= max) return 0;
  const t = cur / max;
  const intel = Math.max(0, intellect);
  if (t <= TRAIN_EASY_RATIO) return TRAIN_EASY_CHANCE;
  if (t <= TRAIN_MID_RATIO) return Math.min(0.95, TRAIN_MID_CHANCE + TRAIN_INTELLECT_MID * intel);
  return Math.min(0.45, TRAIN_LATE_CHANCE + TRAIN_INTELLECT_LATE * intel);
}

export function rollGremlinMastery(
  opts: { current: number; cap: number; intellect: number },
  rng: FarmRng,
): boolean {
  const p = skillTrainChance(opts.current, opts.cap, opts.intellect);
  if (p <= 0) return false;
  return rng.unit() < p;
}

function staminaDrainOf(raw: number): number {
  const n = Math.floor(raw);
  if (n <= 0) return DEFAULT_STAMINA_DRAIN;
  return Math.min(100, n);
}

function applyStaminaRegen(
  stamina: number,
  resetTime: number,
  nowSec: number,
): { stamina: number; resetTime: number } {
  let cur = Number(stamina);
  if (!Number.isFinite(cur)) cur = 100;
  cur = Math.max(0, Math.min(100, cur));
  const reset = Math.max(0, Math.floor(resetTime));
  const now = Math.max(0, Math.floor(nowSec));
  if (cur >= 100) return { stamina: 100, resetTime: 0 };
  if (reset > 0 && now >= reset) return { stamina: 100, resetTime: 0 };
  if (reset > now && STAMINA_REGEN_PER_SEC > 0) {
    const left = Math.max(0, reset - now);
    const missing = left * STAMINA_REGEN_PER_SEC;
    cur = Math.max(0, Math.min(100, 100 - missing));
  }
  return { stamina: cur, resetTime: cur >= 100 ? 0 : reset };
}

function staminaResetUnix(stamina: number, nowSec: number): number {
  const cur = Math.max(0, Math.min(100, stamina));
  if (cur >= 100) return 0;
  return nowSec + Math.ceil((100 - cur) / STAMINA_REGEN_PER_SEC);
}

export function staminaForWire(
  stamina: number,
  resetUnix: number,
  nowSec: number,
): { stamina: number; resetRemaining: number } {
  const regen = applyStaminaRegen(stamina, resetUnix, nowSec);
  const shown = Math.max(0, Math.min(100, Math.round(regen.stamina)));
  if (shown >= 100) return { stamina: 100, resetRemaining: 0 };
  const remaining = Math.max(1, Math.ceil((100 - shown) / STAMINA_REGEN_PER_SEC));
  return { stamina: shown, resetRemaining: remaining };
}

export function drainStaminaForWork(
  stamina: number,
  resetTime: number,
  nowSec: number,
  drain: number,
): { ok: true; stamina: number; resetTime: number } | { ok: false } {
  const cost = staminaDrainOf(drain);
  const regen = applyStaminaRegen(stamina, resetTime, nowSec);
  if (regen.stamina + 1e-9 < cost) return { ok: false };
  const next = Math.max(0, regen.stamina - cost);
  return { ok: true, stamina: next, resetTime: staminaResetUnix(next, nowSec) };
}

export function slotGoldCost(nextSlotIndex: number): number | null {
  if (nextSlotIndex === 0) return SLOT_GOLD[0];
  if (nextSlotIndex === 1) return SLOT_GOLD[1];
  if (nextSlotIndex === 2) return SLOT_GOLD[2];
  return null;
}
