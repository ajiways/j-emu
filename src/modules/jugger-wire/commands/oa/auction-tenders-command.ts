import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import type { AuctionService } from "../../../auction/application/auction-service.ts";
import { parseAuctionSearch, parseAvailableFlag } from "../../application/auction-search-form.ts";
import { buildLotListBlock, loadAuctionOwners } from "../../application/lot-list-block.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionTendersCommand implements OaCommand {
  static readonly key = "auction|tenders";
  readonly key = AuctionTendersCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: Pick<InventoryService, "list">,
    private readonly board: AuctionBoard,
    private readonly auction: Pick<AuctionService, "now">,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form ?? {};
      const page = await this.board.tenders(
        parseAuctionSearch(form),
        parseAvailableFlag(form),
        await this.inventory.list(hero.id),
      );
      return {
        kind: "nested",
        value: await buildLotListBlock(
          page.rows,
          hero.id,
          await loadAuctionOwners(page.rows, this.characters),
          this.catalog,
          this.auction.now(),
          { total: page.total, offs: page.offset },
        ),
      };
    } catch (error) {
      if (error instanceof AuctionDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
