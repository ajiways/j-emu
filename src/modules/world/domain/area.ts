import type { HuntSpawn } from "./hunt-spawn.ts";

export class Area {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly map: string,
    readonly fightBackground: string,
    readonly regionMap: string,
    readonly ftimeMax: number,
    readonly code: string,
    readonly parentId: string,
    readonly context: string,
    readonly soundIntro: string,
    readonly soundBg: string,
    readonly instArtikulId: number,
    readonly haveTradeChannel: number,
    readonly haveKindChannel: number,
    readonly hideFinishedFights: number,
    readonly hideRunningFights: number,
    readonly noClanChat: number,
    readonly spawns: readonly HuntSpawn[],
  ) {
    if (!id) throw new Error("Area id is required");
    if (!title) throw new Error("Area title is required");
    if (!map) throw new Error(`Area ${id} is missing map SWF`);
    if (!fightBackground) throw new Error(`Area ${id} is missing fight background`);
    if (!regionMap) throw new Error(`Area ${id} is missing region_map`);
  }
}
