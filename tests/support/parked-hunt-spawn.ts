import { HuntSpawn } from "../../src/modules/world/domain/hunt-spawn.ts";

export function parkedHuntSpawn(
  id: number,
  botId: number,
  x: number,
  y: number,
  huntMask: string,
  huntSpeed: number,
): HuntSpawn {
  return new HuntSpawn(id, botId, x, y, huntMask, {
    huntSpeed,
    waitMin: 0,
    waitMax: 0,
    respawnTimeMin: 0,
    respawnTimeMax: 0,
    zone: [],
    route: [],
  });
}
