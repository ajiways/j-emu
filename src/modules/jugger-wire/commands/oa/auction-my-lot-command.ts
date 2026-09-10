import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import type { AuctionService } from "../../../auction/application/auction-service.ts";
import { buildLotListBlock, loadAuctionOwners } from "../../application/lot-list-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class AuctionMyLotCommand implements OaCommand {
  static readonly key = "auction|my_lot";
  readonly key = AuctionMyLotCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly board: AuctionBoard,
    private readonly auction: Pick<AuctionService, "now">,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const rows = await this.board.myLot(hero.id);
    return {
      kind: "nested",
      value: await buildLotListBlock(
        rows,
        hero.id,
        await loadAuctionOwners(rows, this.characters),
        this.catalog,
        this.auction.now(),
        null,
      ),
    };
  }
}
