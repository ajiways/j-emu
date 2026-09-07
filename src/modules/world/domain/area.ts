import type { HuntSpawn } from "./hunt-spawn.ts";

export class Area {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly map: string,
    readonly fightBackground: string,
    readonly spawns: readonly HuntSpawn[],
  ) {}
}
