import { CombatService } from "../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../src/modules/combat/application/finished-fight-recorder.ts";
import type { BattleRules } from "../../src/modules/combat/domain/battle-rules.ts";
import { UNIT_BATTLE_RULES } from "./battle-rules.ts";
import { ManualCombatDelay } from "./fakes/manual-combat-delay.ts";
import { MonotonicFightIdSource } from "./fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "./fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "./fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "./fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "./fakes/sequence-random.ts";
import type { RandomSource } from "../../src/modules/combat/domain/random-source.ts";
import type { FinishedFightStore } from "../../src/modules/combat/ports/finished-fight-store.ts";
import type { HistoryWriteObserver } from "../../src/modules/combat/application/history-write-observer.ts";
import type { Clock } from "../../src/shared/kernel/clock.ts";

export function battleRules(overrides: Partial<BattleRules> = {}): BattleRules {
  return { ...UNIT_BATTLE_RULES, ...overrides };
}

export function createCombatService(input: {
  random?: RandomSource;
  rules?: BattleRules;
  clock?: Clock;
  delay?: ManualCombatDelay;
  history?: FinishedFightStore;
  writes?: HistoryWriteObserver;
  fightId?: number;
}): Readonly<{
  combat: CombatService;
  clock: Clock;
  delay: ManualCombatDelay;
  history: FinishedFightStore;
  writes: HistoryWriteObserver;
}> {
  const clock = input.clock ?? new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
  const delay = input.delay ?? new ManualCombatDelay();
  const history = input.history ?? new RecordingFinishedFightStore();
  const writes = input.writes ?? new RecordingHistoryWriteObserver();
  const combat = new CombatService(
    new MonotonicFightIdSource(input.fightId ?? 1),
    input.random ?? new SequenceRandom([8, 2]),
    input.rules ?? UNIT_BATTLE_RULES,
    clock,
    new FinishedFightRecorder(history, clock),
    writes,
    delay,
  );
  return { combat, clock, delay, history, writes };
}
