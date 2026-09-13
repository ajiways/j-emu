import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { SessionPresence } from "../modules/identity/ports/session-presence.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { TradeSession } from "../modules/trade/domain/trade-session.ts";
import type { TradeSessions } from "../modules/trade/application/trade-sessions.ts";
import type { HeldItemsRepository } from "../modules/trade/ports/held-items-repository.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { confirmTrade } from "./trade-confirm.ts";
import { declineTrade } from "./trade-decline.ts";
import { putTradeItem } from "./trade-put.ts";
import { putTradeMoney } from "./trade-put-money.ts";
import { requestTrade } from "./trade-request.ts";
import { readyTrade } from "./trade-ready.ts";
import { confirmTradeSession } from "./trade-session-confirm.ts";
import { declineTradeReady } from "./trade-session-decline.ts";
import { withdrawTradeItem } from "./trade-withdraw.ts";

export type TradeDeskDeps = Readonly<{
  sessions: TradeSessions;
  heldItems: HeldItemsRepository;
  unitOfWork: UnitOfWork;
  characters: Pick<
    CharacterService,
    "getByAccountId" | "getByNick" | "lockById" | "debitMoney" | "creditMoney"
  >;
  inventory: Pick<
    InventoryService,
    "takeFromBagForTrade" | "grantMailSnapshots" | "canFitMailSnapshots"
  >;
  catalog: Catalog;
  presence: SessionPresence;
}>;

export type TradeInvite = Readonly<{
  trayId: number;
  targetAccountId: number;
  targetHeroId: number;
  initiatorNick: string;
  initiatorLevel: number;
  initiatorKind: number;
}>;

export type TradeResult = Readonly<{
  viewerAccountId: number;
  peerAccountId: number | null;
  closed: boolean;
  settled: boolean;
  invite: TradeInvite | null;
  session: TradeSession | null;
}>;

export class TradeDesk {
  constructor(private readonly deps: TradeDeskDeps) {}

  request(accountId: number, nick: string): Promise<TradeResult> {
    return this.deps.sessions.serial(() => requestTrade(this.deps, accountId, nick));
  }

  confirm(accountId: number, trayId: number): Promise<TradeResult> {
    return this.deps.sessions.serial(() => confirmTrade(this.deps, accountId, trayId));
  }

  put(accountId: number, itemId: number, amount: number): Promise<TradeResult> {
    return this.deps.sessions.serial(() => putTradeItem(this.deps, accountId, itemId, amount));
  }

  putMoney(accountId: number, amountGold: number): Promise<TradeResult> {
    return this.deps.sessions.serial(() => putTradeMoney(this.deps, accountId, amountGold));
  }

  withdraw(accountId: number, itemId: number, amount: number): Promise<TradeResult> {
    return this.deps.sessions.serial(() => withdrawTradeItem(this.deps, accountId, itemId, amount));
  }

  ready(accountId: number, confirmKey: string): Promise<TradeResult> {
    return this.deps.sessions.serial(() => readyTrade(this.deps, accountId, confirmKey));
  }

  sessionDecline(accountId: number): Promise<TradeResult> {
    return this.deps.sessions.serial(() => declineTradeReady(this.deps, accountId));
  }

  sessionConfirm(accountId: number, confirmKey: string): Promise<TradeResult> {
    return this.deps.sessions.serial(() => confirmTradeSession(this.deps, accountId, confirmKey));
  }

  decline(accountId: number, trayId: number | null): Promise<TradeResult> {
    return this.deps.sessions.serial(() => declineTrade(this.deps, accountId, trayId));
  }
}
