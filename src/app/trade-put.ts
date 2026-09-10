import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { tradeSnapshotFromMail } from "./trade-item-map.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function putTradeItem(
  deps: TradeDeskDeps,
  accountId: number,
  itemId: number,
  amount: number,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const { session, mine } = deps.sessions.requireOpen(hero.id);
  if (!Number.isInteger(itemId) || itemId < 1) {
    throw new TradeDeniedError("предмет не найден в рюкзаке");
  }
  const quantity = Number.isInteger(amount) && amount >= 1 ? amount : 1;
  const took = await deps.unitOfWork.run(() =>
    deps.inventory.takeFromBagForTrade({
      characterId: hero.id,
      itemId,
      quantity,
    }),
  );
  const existing = mine.artifacts.get(itemId);
  if (existing) {
    mine.artifacts.set(itemId, {
      ...existing,
      quantity: existing.quantity + took.quantity,
    });
  } else {
    mine.artifacts.set(itemId, tradeSnapshotFromMail(took));
  }
  deps.sessions.rotateKey(session);
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
