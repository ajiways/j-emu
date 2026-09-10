import type { HeroBotWin } from "../ports/hero-bestiary.ts";

export function bestiaryInfoWire(
  wins: readonly HeroBotWin[],
): Readonly<{ status: 100; bots: Readonly<Record<string, { id: string; win_cnt: string }>> }> {
  const bots: Record<string, { id: string; win_cnt: string }> = {};
  for (const win of wins) {
    if (!Number.isInteger(win.botId) || win.botId < 1) {
      throw new Error(`Bestiary bot id ${win.botId} is invalid`);
    }
    if (!Number.isInteger(win.winCnt) || win.winCnt < 1) {
      throw new Error(`Bestiary win_cnt for bot ${win.botId} is missing`);
    }
    const id = String(win.botId);
    bots[id] = { id, win_cnt: String(win.winCnt) };
  }
  return { status: 100, bots };
}
