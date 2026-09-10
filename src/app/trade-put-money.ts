import { goldFromMinorUnits, moneyRound } from "../modules/trade/domain/trade-tax.ts";
import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function putTradeMoney(
  deps: TradeDeskDeps,
  accountId: number,
  amountGold: number,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const { session, mine } = deps.sessions.requireOpen(hero.id);
  if (!Number.isFinite(amountGold) || amountGold < 0) {
    throw new TradeDeniedError("отрицательная сумма");
  }
  const have = goldFromMinorUnits(hero.moneyMinor);
  if (amountGold > have + 1e-9) throw new TradeDeniedError("недостаточно денег");
  mine.moneyGold = moneyRound(amountGold);
  deps.sessions.rotateKey(session);
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
