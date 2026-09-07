import type { HuntLook } from "./hunt-look.ts";

export class BotDefinition {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly level: number,
    readonly maxHp: number,
    readonly strength: number,
    readonly hunt: HuntLook,
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid bot id");
    if (!title) throw new Error("Bot title is required");
  }
}
