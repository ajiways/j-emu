export class HudDefaults {
  constructor(
    readonly fightId: number,
    readonly gagTime: number,
    readonly mpTime: number,
    readonly epicValue: number,
    readonly expStatus: number,
    readonly revenge: number,
    readonly revengeMin: number,
    readonly revengeMax: string,
    readonly revengeStatus: number,
    readonly energyPercentMax: number,
    readonly energyPercentCurrent: number,
    readonly injuryTime: number,
    readonly injuryArtikulId: number,
  ) {
    if (fightId < 0 || gagTime < 0 || mpTime < 0 || epicValue < 0 || expStatus < 0) {
      throw new Error("HUD timing defaults cannot be negative");
    }
    if (revenge < 0 || revengeMin < 0 || revengeStatus < 0) {
      throw new Error("HUD revenge defaults cannot be negative");
    }
    if (!revengeMax) throw new Error("HUD revengeMax is required");
    if (energyPercentMax <= 0 || energyPercentCurrent < 0) {
      throw new Error("HUD energy defaults are invalid");
    }
    if (injuryTime < 0 || injuryArtikulId < 0) {
      throw new Error("HUD injury defaults cannot be negative");
    }
  }
}
