export type UseScriptRequire = Readonly<{ artikulId: number; count: number }>;

export type UseScriptEffect =
  | Readonly<{ type: "consume"; artikulId: number; count: number }>
  | Readonly<{ type: "grant"; artikulId: number; count: number }>
  | Readonly<{ type: "openDialog"; dialogKey: string; npcId: number }>;

export class UseScript {
  constructor(
    readonly bonusId: number,
    readonly require: readonly UseScriptRequire[],
    readonly failPlaque: string,
    readonly effects: readonly UseScriptEffect[],
  ) {
    if (!Number.isInteger(bonusId) || bonusId < 1)
      throw new Error("Use script bonusId is required");
    if (effects.length < 1) throw new Error(`Use script ${bonusId} effects are required`);
    for (const row of require) {
      if (!Number.isInteger(row.artikulId) || row.artikulId < 1) {
        throw new Error(`Use script ${bonusId} require artikulId is invalid`);
      }
      if (!Number.isInteger(row.count) || row.count < 1) {
        throw new Error(`Use script ${bonusId} require count is invalid`);
      }
    }
    for (const effect of effects) {
      if (effect.type === "consume" || effect.type === "grant") {
        if (!Number.isInteger(effect.artikulId) || effect.artikulId < 1) {
          throw new Error(`Use script ${bonusId} ${effect.type} artikulId is invalid`);
        }
        if (!Number.isInteger(effect.count) || effect.count < 1) {
          throw new Error(`Use script ${bonusId} ${effect.type} count is invalid`);
        }
      } else if (effect.type === "openDialog") {
        if (!effect.dialogKey) {
          throw new Error(`Use script ${bonusId} openDialog dialogKey is required`);
        }
        if (!Number.isInteger(effect.npcId) || effect.npcId < 1) {
          throw new Error(`Use script ${bonusId} openDialog npcId is invalid`);
        }
      } else {
        throw new Error(`Use script ${bonusId} effect type is not supported`);
      }
    }
  }
}
