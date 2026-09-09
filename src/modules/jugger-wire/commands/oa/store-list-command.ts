import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { buildStoreListBlock } from "../../application/store-list-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class StoreListCommand implements OaCommand {
  static readonly key = "store|list";
  readonly key = StoreListCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    try {
      const types = await this.catalog.storeTypes(hero.areaId);
      const lots = await this.catalog.storeLots(hero.areaId);
      return { kind: "nested", value: await buildStoreListBlock(this.catalog, types, lots) };
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      if (error instanceof Error) throw new ProtocolError(204, error.message);
      throw error;
    }
  }
}
