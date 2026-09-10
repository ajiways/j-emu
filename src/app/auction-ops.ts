import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import { AuctionBid } from "./auction-bid.ts";
import { AuctionBoard } from "./auction-board.ts";
import { AuctionBuyout } from "./auction-buyout.ts";
import { AuctionCancel } from "./auction-cancel.ts";
import { AuctionExpiry } from "./auction-expiry.ts";
import { AuctionList } from "./auction-list.ts";
import { AuctionTenderAdd } from "./auction-tender-add.ts";
import { AuctionTenderCancel } from "./auction-tender-cancel.ts";
import { AuctionTenderSell } from "./auction-tender-sell.ts";

type AuctionOps = Readonly<{
  expiry: AuctionExpiry;
  board: AuctionBoard;
  list: AuctionList;
  bid: AuctionBid;
  buyout: AuctionBuyout;
  cancel: AuctionCancel;
  tenderAdd: AuctionTenderAdd;
  tenderSell: AuctionTenderSell;
  tenderCancel: AuctionTenderCancel;
}>;

export function createAuctionOps(deps: {
  database: UnitOfWork;
  auction: AuctionService;
  mail: MailService;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
}): AuctionOps {
  const expiry = new AuctionExpiry(deps.database, deps.auction, deps.mail, deps.characters);
  return {
    expiry,
    board: new AuctionBoard(expiry, deps.auction),
    list: new AuctionList(
      deps.database,
      expiry,
      deps.characters,
      deps.inventory,
      deps.catalog,
      deps.auction,
    ),
    bid: new AuctionBid(deps.database, expiry, deps.characters, deps.mail, deps.auction),
    buyout: new AuctionBuyout(deps.database, expiry, deps.characters, deps.mail, deps.auction),
    cancel: new AuctionCancel(deps.database, expiry, deps.characters, deps.mail, deps.auction),
    tenderAdd: new AuctionTenderAdd(
      deps.database,
      expiry,
      deps.characters,
      deps.catalog,
      deps.auction,
    ),
    tenderSell: new AuctionTenderSell(
      deps.database,
      expiry,
      deps.characters,
      deps.inventory,
      deps.mail,
      deps.auction,
    ),
    tenderCancel: new AuctionTenderCancel(
      deps.database,
      expiry,
      deps.characters,
      deps.mail,
      deps.auction,
    ),
  };
}
