/**
 * Live DoT/HoT trace from `_research/new_usable_session` (fight vs «Блуждающий призрак»,
 * hero ajiwaysss). Times are seconds from the first fight poll; `ta` is the live
 * `timeAdvance.span` that came with the action. Effects: 283 HoT 80/20, 447 DoT 120/20.
 * Poll timestamps carry about ±1 s of delivery jitter.
 */
export type TraceStep =
  | Readonly<{ t: number; type: "pair"; a: string; b: string }>
  | Readonly<{ t: number; type: "cast"; effect: string; carrier: string }>
  | Readonly<{ t: number; type: "action"; actor: string; ta: number; kills?: string }>;

export type TraceEffect = Readonly<{ kind: 4 | 5; duration: number; period: number }>;

export type ExpectedTick = Readonly<{
  effect: string;
  k: number;
  via: "action" | "timer";
  at: number;
}>;

export const TRACE_EFFECTS: Readonly<Record<string, TraceEffect>> = {
  dot447OnE838: { kind: 4, duration: 120, period: 20 },
  hot283First: { kind: 5, duration: 80, period: 20 },
  hot283Second: { kind: 5, duration: 80, period: 20 },
  dot447OnE926: { kind: 4, duration: 120, period: 20 },
};

export const TRACE_STEPS: readonly TraceStep[] = [
  { t: 0, type: "pair", a: "hero", b: "e838" },
  { t: 0.5, type: "action", actor: "e838", ta: 18.28 },
  { t: 7.3, type: "cast", effect: "dot447OnE838", carrier: "e838" },
  { t: 9.3, type: "cast", effect: "hot283First", carrier: "hero" },
  { t: 14.6, type: "action", actor: "hero", ta: 6.42 },
  { t: 15.6, type: "action", actor: "e838", ta: 18.58 },
  { t: 23.0, type: "action", actor: "hero", ta: 13.34 },
  { t: 23.7, type: "action", actor: "e838", ta: 18.66 },
  { t: 25.2, type: "action", actor: "hero", ta: 15.8 },
  { t: 29.2, type: "pair", a: "hero", b: "e926" },
  { t: 30.3, type: "action", actor: "e926", ta: 19.0 },
  { t: 41.2, type: "action", actor: "hero", ta: 7.26 },
  { t: 43.8, type: "action", actor: "e926", ta: 18.74 },
  { t: 46.2, type: "action", actor: "hero", ta: 13.72 },
  { t: 51.3, type: "action", actor: "e926", ta: 18.28 },
  { t: 54.5, type: "cast", effect: "hot283Second", carrier: "hero" },
  { t: 57.9, type: "cast", effect: "dot447OnE926", carrier: "e926" },
  { t: 58.8, type: "action", actor: "hero", ta: 13.53 },
  { t: 59.5, type: "pair", a: "hero", b: "e838" },
  { t: 60.7, type: "action", actor: "e838", ta: 19.0 },
  { t: 66.0, type: "action", actor: "hero", ta: 13.43 },
  { t: 67.6, type: "action", actor: "e838", ta: 18.56 },
  { t: 71.1, type: "action", actor: "hero", ta: 16.03 },
  { t: 73.0, type: "pair", a: "hero", b: "e926" },
  { t: 73.1, type: "action", actor: "e926", ta: 19.0 },
  { t: 74.5, type: "action", actor: "hero", ta: 13.41 },
  { t: 80.6, type: "action", actor: "e926", ta: 18.59 },
  { t: 82.1, type: "action", actor: "hero", ta: 16.04, kills: "e926" },
];

/** Ticks the client saw (`hpChange` react 32 for HoT, dmgType 256 for DoT), by poll time. */
export const EXPECTED_TICKS: readonly ExpectedTick[] = [
  { effect: "dot447OnE838", k: 1, via: "action", at: 15.6 },
  { effect: "dot447OnE838", k: 2, via: "action", at: 23.0 },
  { effect: "dot447OnE838", k: 3, via: "action", at: 23.7 },
  { effect: "dot447OnE838", k: 4, via: "action", at: 25.2 },
  { effect: "hot283First", k: 1, via: "action", at: 15.6 },
  { effect: "hot283First", k: 2, via: "action", at: 23.0 },
  { effect: "hot283First", k: 3, via: "action", at: 23.7 },
  { effect: "hot283First", k: 4, via: "action", at: 25.2 },
  { effect: "hot283Second", k: 1, via: "action", at: 60.7 },
  { effect: "hot283Second", k: 2, via: "timer", at: 61.2 },
  { effect: "hot283Second", k: 3, via: "action", at: 67.6 },
  { effect: "dot447OnE926", k: 1, via: "action", at: 73.1 },
  { effect: "dot447OnE926", k: 2, via: "action", at: 74.5 },
  { effect: "dot447OnE926", k: 3, via: "action", at: 80.6 },
];

/** `persEff.remainTime` of effect 447 on e926 read from later polls: (poll time, seconds left). */
export const EXPECTED_REMAIN_TIME: readonly Readonly<{
  effect: string;
  at: number;
  remain: number;
}>[] = [
  { effect: "dot447OnE926", at: 64.1, remain: 100.83 },
  { effect: "dot447OnE926", at: 69.2, remain: 95.82 },
  { effect: "dot447OnE926", at: 73.0, remain: 92.29 },
  { effect: "dot447OnE926", at: 74.1, remain: 72.04 },
];
