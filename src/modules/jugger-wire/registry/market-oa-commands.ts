import type { AuctionBoard } from "../../../app/auction-board.ts";
import type { AuctionList } from "../../../app/auction-list.ts";
import type { AuctionBid } from "../../../app/auction-bid.ts";
import type { AuctionBuyout } from "../../../app/auction-buyout.ts";
import type { AuctionCancel } from "../../../app/auction-cancel.ts";
import type { AuctionTenderAdd } from "../../../app/auction-tender-add.ts";
import type { AuctionTenderSell } from "../../../app/auction-tender-sell.ts";
import type { AuctionTenderCancel } from "../../../app/auction-tender-cancel.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import type { AuctionService } from "../../auction/application/auction-service.ts";
import type { BootstrapReadModel } from "../application/bootstrap-read-model.ts";
import type { TradeMutation } from "../application/trade-mutation.ts";
import type { OaCommand } from "../commands/oa/oa-command.ts";
import { AuctionLotCommand } from "../commands/oa/auction-lot-command.ts";
import { AuctionMyLotCommand } from "../commands/oa/auction-my-lot-command.ts";
import { AuctionMyBidCommand } from "../commands/oa/auction-my-bid-command.ts";
import { AuctionMinPriceCommand } from "../commands/oa/auction-min-price-command.ts";
import { AuctionLotAddCommand } from "../commands/oa/auction-lot-add-command.ts";
import { AuctionBidCommand } from "../commands/oa/auction-bid-command.ts";
import { AuctionBuyoutCommand } from "../commands/oa/auction-buyout-command.ts";
import { AuctionCancelCommand } from "../commands/oa/auction-cancel-command.ts";
import { AuctionTendersCommand } from "../commands/oa/auction-tenders-command.ts";
import { AuctionMyTendersCommand } from "../commands/oa/auction-my-tenders-command.ts";
import { AuctionTenderAddCommand } from "../commands/oa/auction-tender-add-command.ts";
import { AuctionTenderCancelCommand } from "../commands/oa/auction-tender-cancel-command.ts";
import { AuctionTenderSellCommand } from "../commands/oa/auction-tender-sell-command.ts";
import { TradeRequestCommand } from "../commands/oa/trade-request-command.ts";
import { TradeConfirmCommand } from "../commands/oa/trade-confirm-command.ts";
import { TradePutCommand } from "../commands/oa/trade-put-command.ts";
import { TradePutMoneyCommand } from "../commands/oa/trade-put-money-command.ts";
import { TradeWithdrawCommand } from "../commands/oa/trade-withdraw-command.ts";
import { TradeSessionReadyCommand } from "../commands/oa/trade-session-ready-command.ts";
import { TradeSessionDeclineCommand } from "../commands/oa/trade-session-decline-command.ts";
import { TradeSessionConfirmCommand } from "../commands/oa/trade-session-confirm-command.ts";
import { TradeDeclineCommand } from "../commands/oa/trade-decline-command.ts";

export function marketOaCommands(input: {
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
  bootstrap: BootstrapReadModel;
  auction: AuctionService;
  auctionBoard: AuctionBoard;
  auctionList: AuctionList;
  auctionBid: AuctionBid;
  auctionBuyout: AuctionBuyout;
  auctionCancel: AuctionCancel;
  auctionTenderAdd: AuctionTenderAdd;
  auctionTenderSell: AuctionTenderSell;
  auctionTenderCancel: AuctionTenderCancel;
  trade: TradeMutation;
}): OaCommand[] {
  return [
    new AuctionLotCommand(input.characters, input.auctionBoard, input.auction, input.catalog),
    new AuctionMyLotCommand(input.characters, input.auctionBoard, input.auction, input.catalog),
    new AuctionMyBidCommand(input.characters, input.auctionBoard, input.auction, input.catalog),
    new AuctionMinPriceCommand(
      input.characters,
      input.inventory,
      input.catalog,
      input.auctionBoard,
    ),
    new AuctionLotAddCommand(input.bootstrap, input.characters, input.auctionList),
    new AuctionBidCommand(input.bootstrap, input.characters, input.auctionBid),
    new AuctionBuyoutCommand(
      input.bootstrap,
      input.characters,
      input.auctionBuyout,
      input.auctionBoard,
      input.auction,
      input.catalog,
    ),
    new AuctionCancelCommand(
      input.bootstrap,
      input.characters,
      input.auctionCancel,
      input.auctionBoard,
      input.auction,
      input.catalog,
    ),
    new AuctionTendersCommand(
      input.characters,
      input.inventory,
      input.auctionBoard,
      input.auction,
      input.catalog,
    ),
    new AuctionMyTendersCommand(input.characters, input.auctionBoard, input.auction, input.catalog),
    new AuctionTenderAddCommand(input.bootstrap, input.characters, input.auctionTenderAdd),
    new AuctionTenderCancelCommand(
      input.bootstrap,
      input.characters,
      input.inventory,
      input.auctionTenderCancel,
      input.auctionBoard,
      input.auction,
      input.catalog,
    ),
    new AuctionTenderSellCommand(
      input.bootstrap,
      input.characters,
      input.inventory,
      input.auctionTenderSell,
      input.auctionBoard,
      input.auction,
      input.catalog,
    ),
    new TradeRequestCommand(input.trade),
    new TradeConfirmCommand(input.trade),
    new TradePutCommand(input.trade),
    new TradePutMoneyCommand(input.trade),
    new TradeWithdrawCommand(input.trade),
    new TradeSessionReadyCommand(input.trade),
    new TradeSessionDeclineCommand(input.trade),
    new TradeSessionConfirmCommand(input.trade),
    new TradeDeclineCommand(input.trade),
  ];
}
