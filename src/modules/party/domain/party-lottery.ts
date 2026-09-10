import { LOTTERY_REROLL_CAP } from "./party-channel.ts";

type LotteryRoll = Readonly<{ heroId: number; roll: number }>;

export type LotteryRound =
  | Readonly<{ kind: "win"; winnerId: number; rolls: readonly LotteryRoll[] }>
  | Readonly<{ kind: "tie"; tied: readonly number[]; rolls: readonly LotteryRoll[] }>;

export function lotteryRound(
  heroIds: readonly number[],
  random: { integer(minInclusive: number, maxInclusive: number): number },
): LotteryRound {
  if (heroIds.length < 1) throw new Error("Lottery pool is empty");
  const rolls = heroIds.map((heroId) => ({
    heroId,
    roll: random.integer(1, 100),
  }));
  let best = -1;
  for (const row of rolls) if (row.roll > best) best = row.roll;
  const tied = rolls.filter((row) => row.roll === best).map((row) => row.heroId);
  if (tied.length === 1) {
    const winnerId = tied[0];
    if (winnerId === undefined) throw new Error("Lottery winner is missing");
    return { kind: "win", winnerId, rolls };
  }
  return { kind: "tie", tied, rolls };
}

export function lotteryCapReached(round: number): boolean {
  return round >= LOTTERY_REROLL_CAP;
}
