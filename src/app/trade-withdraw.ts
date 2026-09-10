import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { mailSnapshotFromTrade } from "./trade-item-map.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function withdrawTradeItem(
  deps: TradeDeskDeps,
  accountId: number,
  itemId: number,
  amount: number,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const { session, mine } = deps.sessions.requireOpen(hero.id);
  if (!Number.isInteger(itemId) || itemId < 1) {
    throw new TradeDeniedError("предмета нет на столе");
  }
  const art = mine.artifacts.get(itemId);
  if (!art) throw new TradeDeniedError("предмета нет на столе");
  const quantity = Number.isInteger(amount) && amount >= 1 ? amount : 1;
  const move = Math.min(quantity, art.quantity);
  await deps.unitOfWork.run(() =>
    deps.inventory.grantMailSnapshots({
      characterId: hero.id,
      snapshots: [mailSnapshotFromTrade({ ...art, quantity: move })],
    }),
  );
  if (move >= art.quantity) mine.artifacts.delete(itemId);
  else mine.artifacts.set(itemId, { ...art, quantity: art.quantity - move });
  deps.sessions.rotateKey(session);
  return openTradeResult(deps.sessions, accountId, hero.id, session);
}
