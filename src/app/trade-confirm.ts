import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function confirmTrade(
  deps: TradeDeskDeps,
  accountId: number,
  trayId: number,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  if (!Number.isInteger(trayId) || trayId < 1) {
    throw new TradeDeniedError("нет предложения обмена");
  }
  const session = deps.sessions.acceptInvite(hero, trayId);
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
