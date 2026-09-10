import type { TradeSession } from "../modules/trade/domain/trade-session.ts";
import type { TradeSessions } from "../modules/trade/application/trade-sessions.ts";
import type { TradeInvite, TradeResult } from "./trade-desk.ts";

export function openTradeResult(
  sessions: TradeSessions,
  viewerAccountId: number,
  viewerHeroId: number,
  session: TradeSession,
  invite: TradeInvite | null = null,
): TradeResult {
  return {
    viewerAccountId,
    peerAccountId: sessions.peerAccountId(session, viewerHeroId),
    closed: false,
    settled: false,
    invite,
    session,
  };
}

export function closedTradeResult(
  viewerAccountId: number,
  peerAccountId: number | null,
  settled: boolean,
): TradeResult {
  return {
    viewerAccountId,
    peerAccountId,
    closed: true,
    settled,
    invite: null,
    session: null,
  };
}
