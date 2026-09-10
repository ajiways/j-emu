import type { AuctionTenderCancel } from "../../../../app/auction-tender-cancel.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import type { AuctionService } from "../../../auction/application/auction-service.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { auctionTenderCancelMutation } from "../../application/auction-lot-mutation.ts";
import { parseAuctionSearch } from "../../application/auction-search-form.ts";
import { buildLotListBlock, loadAuctionOwners } from "../../application/lot-list-block.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionTenderCancelCommand implements OaCommand {
  static readonly key = "auction|tender_cancel";
  readonly key = AuctionTenderCancelCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: Pick<InventoryService, "list">,
    private readonly cancel: AuctionTenderCancel,
    private readonly board: AuctionBoard,
    private readonly auction: Pick<AuctionService, "now">,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      await this.cancel.cancel(hero.id, Number(envelope.form?.lot_id));
      const mine = await this.board.myTenders(hero.id);
      const page = await this.board.tenders(
        parseAuctionSearch({}),
        false,
        await this.inventory.list(hero.id),
      );
      return {
        kind: "flat",
        blocks: auctionTenderCancelMutation(
          await buildLotListBlock(
            mine,
            hero.id,
            await loadAuctionOwners(mine, this.characters),
            this.catalog,
            this.auction.now(),
            null,
          ),
          await buildLotListBlock(
            page.rows,
            hero.id,
            await loadAuctionOwners(page.rows, this.characters),
            this.catalog,
            this.auction.now(),
            { total: page.total, offs: page.offset },
          ),
          await this.bootstrap.bag(accountId),
          await this.bootstrap.state(accountId),
        ),
      };
    } catch (error) {
      if (error instanceof AuctionDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
