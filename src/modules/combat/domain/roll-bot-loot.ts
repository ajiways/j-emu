import type { BotLootEntry } from "../../catalog/domain/bot-loot-entry.ts";
import type { BotReward } from "../../catalog/domain/bot-reward.ts";
import type { RandomSource } from "./random-source.ts";

export type RolledLoot = Readonly<{ artikulId: number; quantity: number }>;

export function rollBotLoot(reward: BotReward, random: RandomSource): readonly RolledLoot[] {
  const granted = new Map<number, number>();
  for (const entry of reward.lootEntries) {
    if (entry.dropWeight > 0) continue;
    addGranted(granted, entry, random.integer(entry.countMin, entry.countMax));
  }
  const pool = reward.lootEntries.filter((entry) => entry.dropWeight > 0);
  let picks = reward.lootDropCnt;
  if (reward.lootBonusChance > 0 && random.unit() < reward.lootBonusChance) {
    picks += rollBonusPickCount(reward.lootBonusMin, reward.lootBonusMax, random);
  }
  if (pool.length > 0 && picks > 0) {
    const weightSum = pool.reduce((sum, entry) => sum + entry.dropWeight, 0);
    const total = weightSum + reward.lootNothingWeight;
    for (let index = 0; index < picks; index += 1) {
      let cursor = random.unit() * total;
      if (cursor < reward.lootNothingWeight) continue;
      cursor -= reward.lootNothingWeight;
      const picked = pickWeighted(pool, cursor) ?? pool[pool.length - 1];
      if (!picked) continue;
      addGranted(granted, picked, random.integer(picked.countMin, picked.countMax));
    }
  }
  return [...granted.entries()]
    .map(([artikulId, quantity]) => ({ artikulId, quantity }))
    .sort((left, right) => left.artikulId - right.artikulId);
}

function addGranted(out: Map<number, number>, entry: BotLootEntry, qty: number): void {
  if (qty <= 0) return;
  if (entry.countMax <= 1) {
    out.set(entry.artikulId, 1);
    return;
  }
  out.set(entry.artikulId, (out.get(entry.artikulId) ?? 0) + qty);
}

function pickWeighted(pool: readonly BotLootEntry[], cursor: number): BotLootEntry | undefined {
  let rest = cursor;
  for (const entry of pool) {
    rest -= entry.dropWeight;
    if (rest <= 0) return entry;
  }
  return undefined;
}

function rollBonusPickCount(min: number, max: number, random: RandomSource): number {
  if (max <= min) return min;
  let total = 0;
  const weights: number[] = [];
  for (let n = min; n <= max; n += 1) {
    const weight = 2 ** (max - n);
    weights.push(weight);
    total += weight;
  }
  let rest = random.unit() * total;
  for (let index = 0; index < weights.length; index += 1) {
    rest -= weights[index] ?? 0;
    if (rest <= 0) return min + index;
  }
  return max;
}
