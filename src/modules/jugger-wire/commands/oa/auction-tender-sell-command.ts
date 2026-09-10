import type { AuctionTenderSell } from "../../../../app/auction-tender-sell.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import type { AuctionService } from "../../../auction/application/auction-service.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { auctionTenderSellMutation } from "../../application/auction-lot-mutation.ts";
import { parseAuctionSearch } from "../../application/auction-search-form.ts";
import { buildLotListBlock, loadAuctionOwners } from "../../application/lot-list-block.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionTenderSellCommand implements OaCommand {
  static readonly key = "auction|tender_sell";
  readonly key = AuctionTenderSellCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: Pick<InventoryService, "list">,
    private readonly sell: AuctionTenderSell,
    private readonly board: AuctionBoard,
    private readonly auction: Pick<AuctionService, "now">,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form ?? {};
      await this.sell.sell({
        heroId: hero.id,
        lotId: Number(form.lot_id),
        artifactId: optionalId(form.artifact_id),
        count: optionalCount(form.cnt),
      });
      const filters = form.filters;
      const search = parseAuctionSearch(
        filters && typeof filters === "object" && !Array.isArray(filters)
          ? (filters as Readonly<Record<string, unknown>>)
          : {},
      );
      const page = await this.board.tenders(search, false, await this.inventory.list(hero.id));
      return {
        kind: "flat",
        blocks: auctionTenderSellMutation(
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

function optionalId(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new AuctionDeniedError("заказ не найден");
  return n;
}

function optionalCount(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 0) throw new AuctionDeniedError("нечего продавать");
  return n;
}
