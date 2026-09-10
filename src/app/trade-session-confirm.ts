import { goldToMinor } from "../modules/character/shared/gold-to-minor.ts";
import { goldFromMinorUnits, moneyRound } from "../modules/trade/domain/trade-tax.ts";
import { TradeDeniedError } from "../modules/trade/domain/trade-denied-error.ts";
import type { TradeSession } from "../modules/trade/domain/trade-session.ts";
import type { TradeDeskDeps, TradeResult } from "./trade-desk.ts";
import { requireTradeHero } from "./trade-hero.ts";
import { mailSnapshotFromTrade } from "./trade-item-map.ts";
import { closedTradeResult, openTradeResult } from "./trade-result-map.ts";
import { trayCost } from "./trade-tray-cost.ts";

export async function confirmTradeSession(
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
  const peerTray = deps.sessions.peerTray(session, hero.id);
  if (!peerTray || mine.confirmed < 1 || peerTray.confirmed < 1) {
    throw new TradeDeniedError("обе стороны должны нажать «готов»");
  }
  mine.confirmed = 2;
  if (peerTray.confirmed < 2) {
    return openTradeResult(deps.sessions, accountId, hero.id, session);
  }
  const peerAccountId = deps.sessions.peerAccountId(session, hero.id);
  try {
    await settleTrade(deps, session);
  } catch (error) {
    mine.confirmed = 1;
    throw error;
  }
  return closedTradeResult(accountId, peerAccountId, true);
}

async function settleTrade(deps: TradeDeskDeps, session: TradeSession): Promise<void> {
  const initiatorId = session.initiatorHeroId;
  const inviteeId = session.inviteeHeroId;
  if (inviteeId === null) throw new TradeDeniedError("партнёр ещё не принял обмен");
  const initiatorTray = session.trays.get(initiatorId);
  const inviteeTray = session.trays.get(inviteeId);
  if (!initiatorTray || !inviteeTray) throw new TradeDeniedError("нет сессии обмена");
  const toInitiator = [...inviteeTray.artifacts.values()].map(mailSnapshotFromTrade);
  const toInvitee = [...initiatorTray.artifacts.values()].map(mailSnapshotFromTrade);
  await deps.unitOfWork.run(async () => {
    const firstId = initiatorId < inviteeId ? initiatorId : inviteeId;
    const secondId = initiatorId < inviteeId ? inviteeId : initiatorId;
    const first = await deps.characters.lockById(firstId);
    const second = await deps.characters.lockById(secondId);
    const initiator = initiatorId === firstId ? first : second;
    const invitee = inviteeId === firstId ? first : second;
    if (
      !(await deps.inventory.canFitMailSnapshots({
        characterId: initiatorId,
        snapshots: toInitiator,
      }))
    ) {
      throw new TradeDeniedError("у партнёра нет места в рюкзаке");
    }
    if (
      !(await deps.inventory.canFitMailSnapshots({
        characterId: inviteeId,
        snapshots: toInvitee,
      }))
    ) {
      throw new TradeDeniedError("нет места в рюкзаке");
    }
    const initiatorCost = await trayCost(initiatorTray, deps.catalog);
    const inviteeCost = await trayCost(inviteeTray, deps.catalog);
    if (goldFromMinorUnits(initiator.moneyMinor) + 1e-9 < initiatorCost.need) {
      throw new TradeDeniedError("недостаточно денег для комиссии обмена");
    }
    if (goldFromMinorUnits(invitee.moneyMinor) + 1e-9 < inviteeCost.need) {
      throw new TradeDeniedError("у партнёра недостаточно денег для комиссии");
    }
    if (toInitiator.length > 0) {
      await deps.inventory.grantMailSnapshots({
        characterId: initiatorId,
        snapshots: toInitiator,
      });
    }
    if (toInvitee.length > 0) {
      await deps.inventory.grantMailSnapshots({
        characterId: inviteeId,
        snapshots: toInvitee,
      });
    }
    await transferMoney(
      deps,
      initiatorId,
      initiatorTray.moneyGold,
      initiatorCost.tax,
      inviteeTray.moneyGold,
    );
    await transferMoney(
      deps,
      inviteeId,
      inviteeTray.moneyGold,
      inviteeCost.tax,
      initiatorTray.moneyGold,
    );
  });
  initiatorTray.artifacts.clear();
  inviteeTray.artifacts.clear();
  deps.sessions.unbind(session);
}

async function transferMoney(
  deps: TradeDeskDeps,
  heroId: number,
  pledgedGold: number,
  taxGold: number,
  incomingGold: number,
): Promise<void> {
  const debitMinor = goldToMinor(moneyRound(pledgedGold + taxGold));
  const creditMinor = goldToMinor(incomingGold);
  if (debitMinor > 0) {
    await deps.characters.debitMoney({
      characterId: heroId,
      minorUnits: debitMinor,
      allowGhost: true,
    });
  }
  if (creditMinor > 0) {
    await deps.characters.creditMoney({ characterId: heroId, minorUnits: creditMinor });
  }
}
