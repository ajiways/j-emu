import { HuntSpawn } from "../../world/domain/hunt-spawn.ts";
import type { DungeonSpawnDefinition } from "../../catalog/domain/dungeon-definition.ts";
import { dungeonHuntId } from "./dungeon-hunt-id.ts";

export function dungeonSpawnToHunt(
  copyId: number,
  spawn: DungeonSpawnDefinition,
  huntSpeed: number,
): HuntSpawn {
  return new HuntSpawn(
    dungeonHuntId(copyId, spawn.spawnKey),
    spawn.huntBotId,
    spawn.positionX,
    spawn.positionY,
    spawn.huntMask,
    {
      huntSpeed,
      waitMin: spawn.waitMin,
      waitMax: spawn.waitMax,
      respawnTimeMin: 0,
      respawnTimeMax: 0,
      zone: spawn.zone,
      route: spawn.route,
    },
  );
}
