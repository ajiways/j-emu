export class LevelBoundary {
  constructor(
    readonly level: number,
    readonly expMin: number,
    readonly expMax: number,
    readonly bagCnt: number,
    readonly honorRank: number,
    readonly honorMin: number,
    readonly honorMax: number,
    readonly honorStatus: number,
  ) {
    if (!Number.isInteger(level) || level < 1) throw new Error("Level must be positive");
    if (expMin < 0 || expMax <= expMin) {
      throw new Error(`Level ${level} EXP bounds are invalid`);
    }
    if (bagCnt < 1) throw new Error(`Level ${level} bag_cnt must be positive`);
    if (honorRank < 0 || honorMin < 0 || honorMax < honorMin || honorStatus < 0) {
      throw new Error(`Level ${level} honor bounds are invalid`);
    }
  }
}
