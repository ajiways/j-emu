import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function declineTradeReady(
  deps: TradeDeskDeps,
  accountId: number,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const { session, mine } = deps.sessions.requireOpen(hero.id);
  mine.confirmed = 0;
  const peer = deps.sessions.peerTray(session, hero.id);
  if (peer && peer.confirmed === 2) peer.confirmed = 1;
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
