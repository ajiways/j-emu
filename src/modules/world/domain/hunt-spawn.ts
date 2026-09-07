export class HuntSpawn {
  constructor(
    readonly id: number,
    readonly botId: number,
    readonly x: number,
    readonly y: number,
    readonly huntMask: string,
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid hunt spawn id");
    if (!Number.isInteger(botId) || botId <= 0) throw new Error("Invalid hunt spawn bot id");
    if (!huntMask) throw new Error(`Hunt spawn ${id} is missing hunt_mask`);
  }
}
