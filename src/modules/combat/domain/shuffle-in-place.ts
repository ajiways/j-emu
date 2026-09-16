import type { RandomSource } from "./random-source.ts";

export function shuffleInPlace<T>(items: T[], random: RandomSource): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = random.integer(0, index);
    const current = items[index];
    const other = items[swap];
    if (current === undefined || other === undefined) {
      throw new Error("Shuffle is missing an item");
    }
    items[index] = other;
    items[swap] = current;
  }
}
