export type DailyCycleRules = Readonly<{
  timeZone: "Europe/Moscow";
  boundaryHour: 6;
  utcOffsetHours: 3;
}>;

export const DAILY_CYCLE_RULES: DailyCycleRules = {
  timeZone: "Europe/Moscow",
  boundaryHour: 6,
  utcOffsetHours: 3,
};

export function isDailyQuest(flags: number): boolean {
  requireFlags(flags);
  return (flags & 1) === 1;
}

export function nextMoscow6am(fromUnixSec: number, rules: DailyCycleRules): number {
  requireUnix(fromUnixSec, "nextMoscow6am");
  requireRules(rules);
  const { y, m, d } = moscowYmd(fromUnixSec, rules);
  const today6 = moscow6amUnix(y, m, d, rules);
  if (fromUnixSec < today6) return today6;
  const next = new Date(Date.UTC(y, m - 1, d + 1, utcHour(rules), 0, 0));
  return Math.floor(next.getTime() / 1000);
}

export function lastMoscow6am(fromUnixSec: number, rules: DailyCycleRules): number {
  requireUnix(fromUnixSec, "lastMoscow6am");
  requireRules(rules);
  const { y, m, d } = moscowYmd(fromUnixSec, rules);
  const today6 = moscow6amUnix(y, m, d, rules);
  if (fromUnixSec >= today6) return today6;
  const prev = new Date(Date.UTC(y, m - 1, d - 1, utcHour(rules), 0, 0));
  return Math.floor(prev.getTime() / 1000);
}

export function dailyCooldownSec(ftimeUnix: number, rules: DailyCycleRules): number {
  requireUnix(ftimeUnix, "daily cooldown ftime");
  const cooldown = nextMoscow6am(ftimeUnix, rules) - ftimeUnix;
  if (cooldown < 0) throw new Error("Daily cooldown is negative");
  return cooldown;
}

export function journalTimes(
  opts: Readonly<{
    flags: number;
    status: "active" | "done";
    startedAt: Date;
    finishedAt: Date | null;
  }>,
  rules: DailyCycleRules,
): Readonly<{ cooldown: number; multitime: 0 | 1; ftime: number; stime: number }> {
  const daily = isDailyQuest(opts.flags);
  const stime = unixOf(opts.startedAt, "quest startedAt");
  if (opts.status === "done" && daily) {
    if (!opts.finishedAt) throw new Error("Daily quest done without finishedAt");
    const ftime = unixOf(opts.finishedAt, "quest finishedAt");
    const cooldown = dailyCooldownSec(ftime, rules);
    if (ftime === 0 && cooldown === 86400) {
      throw new Error("Daily journal must not send ftime:0 with cooldown:86400");
    }
    return { cooldown, multitime: 1, ftime, stime };
  }
  return { cooldown: 0, multitime: daily ? 1 : 0, ftime: 0, stime };
}

export function shouldListInFinishedIds(flags: number, status: string): boolean {
  return status === "done" && !isDailyQuest(flags);
}

export function shouldListFinishedDaily(flags: number, status: string, hidden: 0 | 1): boolean {
  if (hidden !== 0 && hidden !== 1) throw new Error("hidden_in_journal must be 0 or 1");
  return status === "done" && isDailyQuest(flags) && hidden === 0;
}

export function shouldWipeDailyProgress(
  opts: Readonly<{
    flags: number;
    status: "active" | "done";
    startedAtUnix: number;
    finishedAtUnix: number | null;
    last6am: number;
  }>,
): boolean {
  if (!isDailyQuest(opts.flags)) return false;
  requireUnix(opts.last6am, "lastMoscow6am");
  if (opts.status === "active") {
    requireUnix(opts.startedAtUnix, "daily startedAt");
    return opts.startedAtUnix < opts.last6am;
  }
  if (opts.status === "done") {
    if (opts.finishedAtUnix === null) throw new Error("Daily quest done without finishedAt");
    requireUnix(opts.finishedAtUnix, "daily finishedAt");
    return opts.finishedAtUnix < opts.last6am;
  }
  throw new Error(`Quest status ${String(opts.status)} is unknown`);
}

export function questExpOperationId(
  heroId: number,
  questKey: string,
  flags: number,
  finishedAtUnix: number | null,
  rules: DailyCycleRules,
): string {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
  if (!questKey) throw new Error("Quest key is required");
  if (!isDailyQuest(flags)) return `quest:${heroId}:${questKey}:exp`;
  if (finishedAtUnix === null) throw new Error("Daily quest done without finishedAt");
  requireUnix(finishedAtUnix, "daily finishedAt");
  return `quest:${heroId}:${questKey}:exp:${lastMoscow6am(finishedAtUnix, rules)}`;
}

export function questExperienceGrant(
  heroId: number,
  questKey: string,
  flags: number,
  awardExp: number,
  finishedAt: Date,
): Readonly<{ operationId: string; amount: number }> | undefined {
  if (!Number.isInteger(awardExp) || awardExp < 0) throw new Error("Quest awardExp is required");
  if (awardExp === 0) return undefined;
  return {
    operationId: questExpOperationId(
      heroId,
      questKey,
      flags,
      unixOf(finishedAt, "quest finishedAt"),
      DAILY_CYCLE_RULES,
    ),
    amount: awardExp,
  };
}

export function unixOf(value: Date, label: string): number {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} is required`);
  }
  return Math.floor(value.getTime() / 1000);
}

function moscowYmd(
  unixSec: number,
  rules: DailyCycleRules,
): Readonly<{ y: number; m: number; d: number }> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: rules.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(unixSec * 1000));
  return {
    y: requirePart(parts, "year"),
    m: requirePart(parts, "month"),
    d: requirePart(parts, "day"),
  };
}

function moscow6amUnix(y: number, m: number, d: number, rules: DailyCycleRules): number {
  return Math.floor(Date.UTC(y, m - 1, d, utcHour(rules), 0, 0) / 1000);
}

function utcHour(rules: DailyCycleRules): number {
  return rules.boundaryHour - rules.utcOffsetHours;
}

function requireRules(rules: DailyCycleRules): void {
  if (rules.timeZone !== "Europe/Moscow") {
    throw new Error("DailyCycleRules.timeZone must be Europe/Moscow");
  }
  if (rules.boundaryHour !== 6) throw new Error("DailyCycleRules.boundaryHour must be 6");
  if (rules.utcOffsetHours !== 3) throw new Error("DailyCycleRules.utcOffsetHours must be 3");
}

function requireFlags(flags: number): void {
  if (!Number.isInteger(flags) || flags < 0) throw new Error("Quest flags is required");
}

function requireUnix(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} unix seconds is required`);
}

function requirePart(parts: readonly Intl.DateTimeFormatPart[], type: string): number {
  const part = parts.find((item) => item.type === type);
  if (!part) throw new Error(`Europe/Moscow ${type} is required`);
  const value = Number(part.value);
  if (!Number.isInteger(value)) throw new Error(`Europe/Moscow ${type} is invalid`);
  return value;
}
