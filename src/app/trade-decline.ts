import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeSession } from "../modules/trade/domain/trade-session.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { mailSnapshotFromTrade } from "./trade-item-map.ts";
import { closedTradeResult } from "./trade-result-map.ts";

export async function declineTrade(
  deps: TradeDeskDeps,
  accountId: number,
  trayId: number | null,
): Promise<TradeResult> {
  const hero = await requireTradeHero(deps.characters, accountId);
  const session =
    trayId !== null && Number.isInteger(trayId) && trayId >= 1
      ? deps.sessions.sessionForTray(trayId)
      : deps.sessions.sessionForHero(hero.id);
  if (!session) return closedTradeResult(accountId, null, false);
  const allowed =
    session.initiatorHeroId === hero.id ||
    session.pendingInviteeHeroId === hero.id ||
    session.inviteeHeroId === hero.id;
  if (!allowed) throw new TradeDeniedError("это предложение не вам");
  const peerAccountId = peerAccountForDecline(deps, session, hero.id);
  await deps.unitOfWork.run(async () => {
    for (const tray of session.trays.values()) {
      const snapshots = [...tray.artifacts.values()].map(mailSnapshotFromTrade);
      if (snapshots.length < 1) continue;
      await deps.inventory.grantMailSnapshots({
        characterId: tray.heroId,
        snapshots,
      });
      tray.artifacts.clear();
      tray.moneyGold = 0;
    }
  });
  deps.sessions.unbind(session);
  return closedTradeResult(accountId, peerAccountId, false);
}

function peerAccountForDecline(
  deps: TradeDeskDeps,
  session: TradeSession,
  heroId: number,
): number | null {
  const peerTray = deps.sessions.peerTray(session, heroId);
  if (peerTray) return peerTray.accountId;
  if (session.initiatorHeroId !== heroId) {
    const initiator = session.trays.get(session.initiatorHeroId);
    return initiator === undefined ? null : initiator.accountId;
  }
  return null;
}
