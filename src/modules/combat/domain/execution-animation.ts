import type { RandomSource } from "./random-source.ts";

/** The nine finishing blows of the old game and the count of executions that unlocks each. */
const EXECUTION_ANIMATIONS: readonly Readonly<{ unlockedAt: number; id: string }>[] = [
  { unlockedAt: 0, id: "fatality1" }, // Сокрушающий удар
  { unlockedAt: 50, id: "fatality2" }, // Град ударов
  { unlockedAt: 100, id: "fatality3" }, // Низвержение
  { unlockedAt: 200, id: "fatality4" }, // Вертиго
  { unlockedAt: 300, id: "fatality5" }, // Длань вампира
  { unlockedAt: 400, id: "fatality6" }, // Вермилион
  { unlockedAt: 500, id: "fatality7" }, // Гнев земли
  { unlockedAt: 600, id: "fatality8" }, // Сияние смерти
  { unlockedAt: 700, id: "fatality9" }, // Стальная симфония
];

/**
 * The animation of an execution: a random one of those the fighter has unlocked, the execution
 * being carried out now included in `count` (his executions of all fights).
 */
export function pickExecutionAnimation(count: number, random: RandomSource): string {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("The execution count includes the one carried out and is at least 1");
  }
  const pool = EXECUTION_ANIMATIONS.filter((row) => count >= row.unlockedAt);
  const picked = pool[random.integer(0, pool.length - 1)];
  if (!picked) throw new Error("Execution animation pool is empty");
  return picked.id;
}
