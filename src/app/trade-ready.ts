import { goldFromMinorUnits } from "../modules/trade/domain/trade-tax.ts";
import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { openTradeResult } from "./trade-result-map.ts";
import { trayCost } from "./trade-tray-cost.ts";

export async function readyTrade(
  deps: TradeDeskDeps,
  accountId: number,
  confirmKey: string,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const { session, mine } = deps.sessions.requireOpen(hero.id);
  if (session.inviteeHeroId === null) {
    throw new TradeDeniedError("партнёр ещё не принял обмен");
  }
  if (confirmKey && confirmKey !== session.confirmKey) {
    throw new TradeDeniedError("неверный confirm_key");
  }
  const { need } = await trayCost(mine, deps.catalog);
  if (goldFromMinorUnits(hero.moneyMinor) + 1e-9 < need) {
    throw new TradeDeniedError("недостаточно денег для комиссии обмена");
  }
  mine.confirmed = 1;
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
