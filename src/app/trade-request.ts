import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { openTradeResult } from "./trade-result-map.ts";

export async function requestTrade(
  deps: TradeDeskDeps,
  accountId: number,
  nickRaw: string,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const nick = nickRaw.trim();
  if (!nick) throw new TradeDeniedError("укажите ник");
  if (nick.toLowerCase() === hero.nick.toLowerCase()) {
    throw new TradeDeniedError("нельзя торговать с собой");
  }
  if (deps.sessions.hasHero(hero.id)) throw new TradeDeniedError("уже идёт обмен");
  const target = await deps.characters.getByNick(nick);
  if (!target) throw new TradeDeniedError("игрок не в сети");
  const online = new Set(await deps.presence.listAccountIdsWithSession());
  if (!online.has(target.accountId)) throw new TradeDeniedError("игрок не в сети");
  if (deps.sessions.hasHero(target.id)) throw new TradeDeniedError("игрок уже обменивается");
  const session = deps.sessions.openRequest(hero, target);
  const mine = session.trays.get(hero.id);
  if (!mine) throw new Error("Initiator tray is missing after trade request");
  return openTradeResult(deps.sessions, accountId, hero.id, session, {
    trayId: mine.id,
    targetAccountId: target.accountId,
    targetHeroId: target.id,
    initiatorNick: hero.nick,
    initiatorLevel: hero.level,
    initiatorKind: hero.kind,
  });
}
