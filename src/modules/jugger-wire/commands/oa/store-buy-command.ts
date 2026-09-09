import type { StorePurchase } from "../../../../app/store-purchase.ts";
import { StoreDeniedError } from "../../../../app/store-denied-error.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { GhostHeroError } from "../../../character/domain/ghost-hero-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { storeBuyMutation } from "../../application/store-buy-mutation.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { parseStoreBasket } from "./parse-store-basket.ts";

export class StoreBuyCommand implements OaCommand {
  static readonly key = "store|buy";
  readonly key = StoreBuyCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly purchase: StorePurchase,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return this.encode(await this.handle({ accountId }, envelope));
    } catch (error) {
      if (error instanceof StoreDeniedError) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      if (error instanceof GhostHeroError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  private async handle(context: OaCommandContext, envelope: ObjectActionEnvelope): Promise<object> {
    const hero = await this.characters.getByAccountId(context.accountId);
    if (!hero) throw new Error(`Hero for account ${context.accountId} is missing`);
    await this.purchase.buy({
      characterId: hero.id,
      areaId: hero.areaId,
      lines: parseStoreBasket(envelope),
    });
    return storeBuyMutation(
      await this.bootstrap.bag(context.accountId),
      await this.bootstrap.state(context.accountId),
    );
  }

  private encode(response: object): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }
}
