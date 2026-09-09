import type { HuntBotSnapshot } from "../../world/domain/hunt-bot-snapshot.ts";

/** Idle hunt bot is not in a fight. Live sends 0; this is not a catalog fallback. */
export const IDLE_HUNT_FIGHT_ID = 0;

type HuntWireBot = Readonly<{
  id: number;
  artikul_id: number;
  fight_id: number;
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

export function buildHuntBlock(bots: readonly HuntBotSnapshot[]): HuntBlock {
  return {
    status: 100,
    bots: bots.map((bot) => ({
      id: bot.id,
      artikul_id: bot.artikulId,
      fight_id: bot.fightId,
      hunt_mask: bot.huntMask,
      position_x: bot.positionX,
      position_y: bot.positionY,
      prev_x: bot.prevX,
      prev_y: bot.prevY,
    })),
  };
}
