export class AreaLink {
  constructor(
    readonly fromAreaId: string,
    readonly itemId: number,
    readonly toAreaId: string,
    readonly title: string,
    readonly picture: string,
    readonly description: string,
    readonly flags: number,
    readonly direction: number,
  ) {
    if (!fromAreaId) throw new Error("Area link from-area is required");
    if (!Number.isInteger(itemId) || itemId < 0) {
      throw new Error(`Area link item id ${itemId} is invalid`);
    }
    if (!toAreaId) throw new Error(`Area link ${fromAreaId}:${itemId} is missing to-area`);
    if (!Number.isInteger(flags) || flags < 0) {
      throw new Error(`Area link ${fromAreaId}:${itemId} flags are invalid`);
    }
    if (!Number.isInteger(direction) || direction < 0) {
      throw new Error(`Area link ${fromAreaId}:${itemId} direction is invalid`);
    }
  }
}
