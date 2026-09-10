import type { AuctionBid } from "../../../../app/auction-bid.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { auctionBidMutation } from "../../application/auction-lot-mutation.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionBidCommand implements OaCommand {
  static readonly key = "auction|bid";
  readonly key = AuctionBidCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly bid: AuctionBid,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const placed = await this.bid.place({
        heroId: hero.id,
        lotId: Number(envelope.form?.lot_id),
        bidGold: Number(envelope.form?.bid),
      });
      return {
        kind: "flat",
        blocks: auctionBidMutation(
          placed.lotId,
          placed.bidGold,
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
