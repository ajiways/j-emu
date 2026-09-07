import type { HuntSpawn } from "../../world/domain/hunt-spawn.ts";

/** Idle hunt bot is not in a fight. Live sends 0; this is not a catalog fallback. */
export const IDLE_HUNT_FIGHT_ID = 0;

type HuntWireBot = Readonly<{
  id: number;
  artikul_id: number;
  fight_id: typeof IDLE_HUNT_FIGHT_ID;
  hunt_mask: string;
  position_x: number;
  position_y: number;
  prev_x: number;
  prev_y: number;
}>;

export type HuntBlock = Readonly<{
  status: 100;
  bots: readonly HuntWireBot[];
}>;

export function buildHuntBlock(spawns: readonly HuntSpawn[]): HuntBlock {
  return {
    status: 100,
    bots: spawns.map((spawn) => ({
      id: spawn.id,
      artikul_id: spawn.botId,
      fight_id: IDLE_HUNT_FIGHT_ID,
      hunt_mask: spawn.huntMask,
      position_x: spawn.x,
      position_y: spawn.y,
      prev_x: spawn.x,
      prev_y: spawn.y,
    })),
  };
}
