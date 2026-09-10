import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { InventoryService } from "../../../inventory/domain/inventory-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { AuctionBoard } from "../../../../app/auction-board.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionMinPriceCommand implements OaCommand {
  static readonly key = "auction|min_price";
  readonly key = AuctionMinPriceCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly inventory: Pick<InventoryService, "list">,
    private readonly catalog: Catalog,
    private readonly board: AuctionBoard,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const artifactId = Number(envelope.form?.artifact_id);
      const amountRaw = envelope.form?.amount;
      const amount =
        amountRaw === undefined || amountRaw === null || amountRaw === ""
          ? 1
          : Math.floor(Number(amountRaw));
      if (
        !Number.isInteger(artifactId) ||
        artifactId < 1 ||
        !Number.isInteger(amount) ||
        amount < 1
      ) {
        throw new AuctionDeniedError("Таких лотов нет.");
      }
      const artikulId = await resolveArtikul(this.inventory, this.catalog, hero.id, artifactId);
      const buyout = await this.board.minPrice(artikulId, amount);
      return { kind: "nested", value: { status: 100, buyout } };
    } catch (error) {
      if (error instanceof AuctionDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}

async function resolveArtikul(
  inventory: Pick<InventoryService, "list">,
  catalog: Catalog,
  heroId: number,
  artifactId: number,
): Promise<number> {
  const item = (await inventory.list(heroId)).find((row) => row.id === artifactId);
  if (item) return item.artifactId;
  const definition = await catalog.artifact(artifactId);
  if (definition) return definition.id;
  throw new AuctionDeniedError("Таких лотов нет.");
}
