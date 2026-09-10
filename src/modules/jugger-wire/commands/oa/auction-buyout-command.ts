import type { AuctionBuyout } from "../../../../app/auction-buyout.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import type { AuctionService } from "../../../auction/application/auction-service.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { parseAuctionSearch } from "../../application/auction-search-form.ts";
import { auctionBuyoutMutation } from "../../application/auction-lot-mutation.ts";
import { buildLotListBlock, loadAuctionOwners } from "../../application/lot-list-block.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionBuyoutCommand implements OaCommand {
  static readonly key = "auction|buyout";
  readonly key = AuctionBuyoutCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly buyout: AuctionBuyout,
    private readonly board: AuctionBoard,
    private readonly auction: Pick<AuctionService, "now">,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      await this.buyout.buy(hero.id, Number(envelope.form?.lot_id));
      const filters = envelope.form?.filters;
      const search = parseAuctionSearch(
        filters && typeof filters === "object" && !Array.isArray(filters)
          ? (filters as Readonly<Record<string, unknown>>)
          : {},
      );
      const page = await this.board.lots(search);
      return {
        kind: "flat",
        blocks: auctionBuyoutMutation(
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
